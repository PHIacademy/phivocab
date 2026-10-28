// Bulk-creates student (or teacher) accounts from a CSV roster.
//
// CSV format (header row required):
//   full_name,email,role,cohort
//   Chan Tai Man,chan.tm@example.com,student,B1 Tuesday
//   Ms. Wong,wong@example.com,teacher,B1 Tuesday
//
// - "role" is "student" or "teacher"
// - "cohort" is matched/created by name (case-sensitive)
// - For a teacher row, a cohort is created with them as its teacher
//   if it doesn't already exist; students are attached to that cohort.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/provision.js roster.csv
//
// Each person receives a Supabase magic-link email automatically the
// first time they try to sign in — no password is set here.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/provision.js roster.csv');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateCohort(name, teacherId) {
  const { data: existing } = await supabase.from('cohorts').select('*').eq('name', name).maybeSingle();
  if (existing) {
    // Attach a teacher to a cohort that doesn't have one yet (e.g. it was
    // first created from a students-only CSV row before any teacher row
    // for that cohort was added). Never overwrites an existing teacher_id.
    if (teacherId && !existing.teacher_id) {
      const { data: updated, error } = await supabase
        .from('cohorts')
        .update({ teacher_id: teacherId })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }
    return existing;
  }
  const { data, error } = await supabase
    .from('cohorts')
    .insert({ name, teacher_id: teacherId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createPerson(row, cohortId) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: row.email,
    email_confirm: true,
  });
  if (error) {
    // Already exists — look it up instead of failing the whole run.
    const { data: list } = await supabase.auth.admin.listUsers();
    const found = list?.users?.find((u) => u.email === row.email);
    if (!found) throw error;
    return found;
  }
  return created.user;
}

async function main() {
  const raw = fs.readFileSync(path.resolve(csvPath), 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  // First pass: create any teacher accounts and their cohorts.
  const cohortIdByName = {};
  for (const row of rows) {
    if (row.role === 'teacher') {
      const user = await createPerson(row, null);
      const cohort = await getOrCreateCohort(row.cohort, user.id);
      cohortIdByName[row.cohort] = cohort.id;
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: row.full_name,
        role: 'teacher',
        cohort_id: cohort.id,
      });
      console.log(`✓ teacher  ${row.full_name} <${row.email}>  cohort "${row.cohort}"`);
    }
  }

  // Second pass: students, attached to their cohort (created above or pre-existing).
  for (const row of rows) {
    if (row.role !== 'student') continue;
    let cohortId = cohortIdByName[row.cohort];
    if (!cohortId) {
      const cohort = await getOrCreateCohort(row.cohort, null);
      cohortId = cohort.id;
      cohortIdByName[row.cohort] = cohortId;
    }
    const user = await createPerson(row, cohortId);
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: row.full_name,
      role: 'student',
      cohort_id: cohortId,
    });
    console.log(`✓ student  ${row.full_name} <${row.email}>  cohort "${row.cohort}"`);
  }

  console.log('\nDone. Everyone signs in at /login with their email — Supabase sends them a magic link.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

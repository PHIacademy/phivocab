// Imports (creates or updates) a single unit from a JSON file straight into
// the `units` table — handy for seeding a unit you already have content for
// instead of retyping it into the dashboard form.
//
// JSON shape (see scripts/units/unit-1.json for a full example):
//   {
//     "id": "unit-1",
//     "title": "...",
//     "eyebrow": "...",
//     "summary": "...",
//     "order": 1,
//     "cohort": null,              // cohort NAME (string) or null = all cohorts
//     "createdBy": "teacher@example.com", // teacher email — sets created_by so
//                                          // they can edit the unit later from
//                                          // the dashboard (required for that)
//     "zhGloss": "...",
//     "structNote": "...",
//     "words": [{ "pos": "...", "word": "...", "def": "...", "zh": "...", "ex": "..." }, ...],
//     "blanks": [{ "sentence": "...", "answer": "..." }, ...],
//     "structurePieces": ["...", "..."],
//     "structureSkeleton": ["...", "..."]
//   }
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-unit.js scripts/units/unit-1.json

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/import-unit.js scripts/units/unit-1.json');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveCohortId(cohortName) {
  if (!cohortName) return null;
  const { data, error } = await supabase.from('cohorts').select('id').eq('name', cohortName).maybeSingle();
  if (error) throw error;
  if (!data) {
    console.warn(`⚠ cohort "${cohortName}" not found — saving unit as visible to all cohorts instead.`);
    return null;
  }
  return data.id;
}

async function resolveTeacherId(email) {
  if (!email) return null;
  const { data: list, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const found = list?.users?.find((u) => u.email === email);
  if (!found) {
    console.warn(`⚠ no account found for createdBy "${email}" — unit will be saved without an owner, and won't be editable from the dashboard until fixed.`);
    return null;
  }
  return found.id;
}

async function main() {
  const raw = fs.readFileSync(path.resolve(jsonPath), 'utf8');
  const unit = JSON.parse(raw);

  if (!unit.id || !unit.title) {
    console.error('JSON must include at least "id" and "title".');
    process.exit(1);
  }

  const cohortId = await resolveCohortId(unit.cohort);
  const createdBy = await resolveTeacherId(unit.createdBy);

  const payload = {
    id: unit.id,
    title: unit.title,
    eyebrow: unit.eyebrow || '',
    summary: unit.summary || '',
    order: Number(unit.order) || 0,
    zh_gloss: unit.zhGloss || '',
    struct_note: unit.structNote || '',
    words: unit.words || [],
    blanks: unit.blanks || [],
    structure_pieces: unit.structurePieces || [],
    structure_skeleton: unit.structureSkeleton || [],
    cohort_id: cohortId,
    updated_at: new Date().toISOString(),
    // Only included when resolved, so re-running without "createdBy" in the
    // JSON never clobbers an owner that was already set on a prior run.
    ...(createdBy ? { created_by: createdBy } : {}),
  };

  const { error } = await supabase.from('units').upsert(payload, { onConflict: 'id' });
  if (error) throw error;

  console.log(`✓ unit "${unit.id}" (${unit.title}) imported — ${payload.words.length} words, ${payload.blanks.length} blanks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

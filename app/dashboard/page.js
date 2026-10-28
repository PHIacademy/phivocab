'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import SignOutButton from '../SignOutButton';

export default function DashboardPage() {
  const supabase = useRef(supabaseBrowser()).current;
  const [me, setMe] = useState(null);
  const [cohorts, setCohorts] = useState(null);
  const [activeCohort, setActiveCohort] = useState(null);
  const [students, setStudents] = useState([]);
  const [progressByUser, setProgressByUser] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Wait for the browser client to finish loading the session from
      // storage before firing any RLS-protected query — querying right away
      // on mount can race ahead of session init and silently come back
      // empty (anon-level request), even though getUser() looks fine.
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[dashboard] session:', session ? `user ${session.user.id}` : 'NONE');
      if (!session || !active) return;

      const [{ data: profile, error: profileErr }, { data: cohortRows, error: cohortErr }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', session.user.id).single(),
        supabase.from('cohorts').select('*'),
      ]);
      console.log('[dashboard] profile:', profile, 'error:', profileErr);
      console.log('[dashboard] cohorts:', cohortRows, 'error:', cohortErr);
      if (!active) return;

      setMe({ email: session.user.email, full_name: profile?.full_name || '' });
      setCohorts(cohortRows || []);
      if (cohortRows && cohortRows.length) setActiveCohort(cohortRows[0]);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeCohort) return;
    supabase.from('profiles').select('*').eq('cohort_id', activeCohort.id).eq('role', 'student').then(async ({ data }) => {
      const list = data || [];
      setStudents(list);
      setSelectedStudent(null);
      if (list.length === 0) return;
      const ids = list.map((s) => s.id);
      const { data: rows } = await supabase.from('progress').select('*').in('user_id', ids);
      const grouped = {};
      (rows || []).forEach((r) => {
        grouped[r.user_id] = grouped[r.user_id] || [];
        grouped[r.user_id].push(r);
      });
      setProgressByUser(grouped);
    });
  }, [activeCohort]);

  function masteryPct(userId) {
    const rows = progressByUser[userId] || [];
    if (rows.length === 0) return null;
    const mastered = rows.filter((r) => r.mastered_at).length;
    return Math.round((mastered / rows.length) * 100);
  }

  if (!cohorts) return <main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Teacher Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 2px' }}>Roster and mastery progress by cohort.</p>
          {me && (
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
              Signed in as <strong>{me.full_name}</strong> &lt;{me.email}&gt;
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard/units" style={{ ...linkBtn }}>Manage units →</Link>
          <SignOutButton />
        </div>
      </div>

      {cohorts.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No cohorts yet. Create one in Supabase or ask your admin.</p>
      ) : (
        <>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
            Your cohorts ({cohorts.length})
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {cohorts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCohort(c)}
                style={{
                  padding: '8px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
                  border: '1px solid ' + (activeCohort?.id === c.id ? 'var(--accent)' : 'var(--line)'),
                  background: activeCohort?.id === c.id ? 'var(--accent)' : 'var(--surface)',
                  color: activeCohort?.id === c.id ? '#fff' : 'var(--ink)',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className={selectedStudent ? 'dashGrid dashGrid--split' : 'dashGrid'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No students in this cohort yet.</p>}
              {students.map((s) => {
                const pct = masteryPct(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    style={{
                      textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--surface)', border: '1px solid ' + (selectedStudent?.id === s.id ? 'var(--accent)' : 'var(--line)'),
                      borderRadius: 10, padding: '12px 16px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14.5 }}>{s.full_name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: pct === null ? 'var(--muted)' : pct === 100 ? 'var(--good)' : 'var(--muted)' }}>
                      {pct === null ? 'no activity' : `${pct}% mastered`}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedStudent && (
              <StudentDetail student={selectedStudent} rows={progressByUser[selectedStudent.id] || []} />
            )}
          </div>
          <style jsx>{`
            .dashGrid { display: grid; grid-template-columns: 1fr; gap: 20px; }
            @media (min-width: 760px) {
              .dashGrid--split { grid-template-columns: 1fr 1.3fr; }
            }
          `}</style>
        </>
      )}
    </main>
  );
}

const linkBtn = {
  display: 'inline-block', padding: '9px 14px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
  border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', textDecoration: 'none',
};

function StudentDetail({ student, rows }) {
  const byUnit = {};
  rows.forEach((r) => {
    byUnit[r.unit_id] = byUnit[r.unit_id] || { recall: [], blank: [] };
    byUnit[r.unit_id][r.drill_type].push(r);
  });

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>{student.full_name}</h3>
      {Object.keys(byUnit).length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No attempts recorded yet.</p>}
      {Object.entries(byUnit).map(([unitId, drills]) => (
        <div key={unitId} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{unitId}</div>
          <DrillSummary label="Recall" items={drills.recall} />
          <DrillSummary label="Fill-in-blank" items={drills.blank} />
        </div>
      ))}
    </div>
  );
}

function DrillSummary({ label, items }) {
  if (items.length === 0) return null;
  const mastered = items.filter((i) => i.mastered_at).length;
  const notMastered = items.filter((i) => !i.mastered_at);
  return (
    <div style={{ fontSize: 13, marginBottom: 8 }}>
      <strong>{label}:</strong> {mastered}/{items.length} mastered
      {notMastered.length > 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>
          Still working on: {notMastered.map((i) => i.item_key).join(', ')}
        </div>
      )}
    </div>
  );
}

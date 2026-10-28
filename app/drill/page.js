'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import SignOutButton from '../SignOutButton';
import { UnitDrill } from '../UnitDrill';

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DrillPage() {
  const supabase = useRef(supabaseBrowser()).current;
  const [userId, setUserId] = useState(null);
  const [fullName, setFullName] = useState('');
  const [units, setUnits] = useState(null);
  const [unit, setUnit] = useState(null);
  // All progress rows for this student, across every unit — used both to
  // render per-unit stats on the unit list and as the source for the open
  // unit's drills, so we only ever fetch progress once per page load.
  const [allProgress, setAllProgress] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setUserId(uid);
      if (!uid) return;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
      setFullName(profile?.full_name || '');
      const { data: rows } = await supabase.from('progress').select('*').eq('user_id', uid);
      setAllProgress(rows || []);
    });
  }, []);

  useEffect(() => {
    supabase.from('units').select('*').order('order', { ascending: true }).then(({ data }) => {
      setUnits(data || []);
    });
  }, []);

  function progressForUnit(unitId) {
    return allProgress.filter((r) => r.unit_id === unitId);
  }

  function histFor(drillType, itemKey) {
    if (!unit) return [];
    const row = allProgress.find((r) => r.unit_id === unit.id && r.drill_type === drillType && r.item_key === itemKey);
    return row ? row.history : [];
  }

  async function recordAttempt(drillType, itemKey, ok) {
    const prevHist = histFor(drillType, itemKey);
    const hist = [...prevHist, ok].slice(-5);
    const mastered = hist.length === 5 && hist.every((v) => v === true);
    const updatedAt = new Date().toISOString();

    await supabase.from('progress').upsert(
      {
        user_id: userId,
        unit_id: unit.id,
        drill_type: drillType,
        item_key: itemKey,
        history: hist,
        mastered_at: mastered ? updatedAt : null,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,unit_id,drill_type,item_key' }
    );

    setAllProgress((rows) => {
      const others = rows.filter((r) => !(r.unit_id === unit.id && r.drill_type === drillType && r.item_key === itemKey));
      return [...others, { unit_id: unit.id, drill_type: drillType, item_key: itemKey, history: hist, mastered_at: mastered ? updatedAt : null, updated_at: updatedAt }];
    });
    return hist;
  }

  if (!units) return <Centered>Loading…</Centered>;
  if (!unit) return <UnitList units={units} fullName={fullName} progressForUnit={progressForUnit} onOpen={setUnit} />;

  return (
    <UnitDrill
      unit={unit}
      onBack={() => setUnit(null)}
      histFor={histFor}
      recordAttempt={recordAttempt}
    />
  );
}

function Centered({ children }) {
  return <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px', textAlign: 'center', color: 'var(--muted)' }}>{children}</main>;
}

function UnitList({ units, fullName, progressForUnit, onOpen }) {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{fullName ? `${fullName}'s Units` : 'Your Units'}</h1>
        <SignOutButton />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
        Tap a unit to open its drills.
      </p>
      {units.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>No units yet — ask your teacher to add one.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {units.map((u) => {
          const rows = progressForUnit(u.id);
          const wordCount = (u.words || []).length;
          const blankCount = (u.blanks || []).length;
          const masteredWords = rows.filter((r) => r.drill_type === 'recall' && r.mastered_at).length;
          const masteredBlanks = rows.filter((r) => r.drill_type === 'blank' && r.mastered_at).length;
          const lastTrial = rows.reduce((latest, r) => {
            if (!r.updated_at) return latest;
            return !latest || r.updated_at > latest ? r.updated_at : latest;
          }, null);

          return (
            <button
              key={u.id}
              onClick={() => onOpen(u)}
              style={{
                textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer', color: 'var(--ink)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17 }}>{u.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                {wordCount} words ({masteredWords} mastered) · {blankCount} blanks ({masteredBlanks} mastered) · {u.eyebrow}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {lastTrial ? `Last trial: ${fmtDate(lastTrial)}` : 'Not attempted yet'}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

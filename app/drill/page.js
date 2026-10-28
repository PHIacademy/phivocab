'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabaseBrowser';
import SignOutButton from '../SignOutButton';
import { UnitDrill } from '../UnitDrill';

export default function DrillPage() {
  const supabase = useRef(supabaseBrowser()).current;
  const [userId, setUserId] = useState(null);
  const [units, setUnits] = useState(null);
  const [unit, setUnit] = useState(null);
  const [progressRows, setProgressRows] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    supabase.from('units').select('*').order('order', { ascending: true }).then(({ data }) => {
      setUnits(data || []);
    });
  }, []);

  async function openUnit(u) {
    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userId)
      .eq('unit_id', u.id);
    setProgressRows(data || []);
    setUnit(u);
  }

  function histFor(drillType, itemKey) {
    const row = progressRows.find((r) => r.drill_type === drillType && r.item_key === itemKey);
    return row ? row.history : [];
  }

  async function recordAttempt(drillType, itemKey, ok) {
    const prevHist = histFor(drillType, itemKey);
    const hist = [...prevHist, ok].slice(-5);
    const mastered = hist.length === 5 && hist.every((v) => v === true);

    await supabase.from('progress').upsert(
      {
        user_id: userId,
        unit_id: unit.id,
        drill_type: drillType,
        item_key: itemKey,
        history: hist,
        mastered_at: mastered ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,unit_id,drill_type,item_key' }
    );

    setProgressRows((rows) => {
      const others = rows.filter((r) => !(r.drill_type === drillType && r.item_key === itemKey));
      return [...others, { drill_type: drillType, item_key: itemKey, history: hist }];
    });
    return hist;
  }

  if (!units) return <Centered>Loading…</Centered>;
  if (!unit) return <UnitList units={units} onOpen={openUnit} />;

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

function UnitList({ units, onOpen }) {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Your Units</h1>
        <SignOutButton />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
        Tap a unit to open its drills.
      </p>
      {units.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>No units yet — ask your teacher to add one.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {units.map((u) => (
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
              {(u.words || []).length} words · {u.eyebrow}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

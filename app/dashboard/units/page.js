'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabaseBrowser';

export default function UnitsListPage() {
  const supabase = useRef(supabaseBrowser()).current;
  const [units, setUnits] = useState(null);

  useEffect(() => {
    supabase.from('units').select('*').order('order', { ascending: true }).then(({ data }) => setUnits(data || []));
  }, []);

  async function remove(id) {
    if (!confirm('Delete this unit? This cannot be undone.')) return;
    await supabase.from('units').delete().eq('id', id);
    setUnits((u) => u.filter((x) => x.id !== id));
  }

  if (!units) return <main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--accent)' }}>← Dashboard</Link>
          <h1 style={{ fontSize: 24, margin: '6px 0 0' }}>Units</h1>
        </div>
        <Link
          href="/dashboard/units/new"
          style={{ padding: '9px 14px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}
        >
          + New unit
        </Link>
      </div>

      {units.length === 0 && <p style={{ color: 'var(--muted)' }}>No units yet — create the first one.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {units.map((u) => (
          <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>{u.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                {u.id} · {(u.words || []).length} words · {(u.blanks || []).length} blanks
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/dashboard/units/preview?id=${u.id}`} style={{ fontSize: 13, color: 'var(--accent)' }}>Preview</Link>
              <Link href={`/dashboard/units/new?edit=${u.id}`} style={{ fontSize: 13, color: 'var(--accent)' }}>Edit</Link>
              <button onClick={() => remove(u.id)} style={{ fontSize: 13, color: 'var(--bad)', background: 'none', border: 'none' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

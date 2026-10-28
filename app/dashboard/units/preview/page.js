'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabaseBrowser';
import { UnitDrill } from '../../../UnitDrill';

export default function PreviewPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>}>
      <PreviewUnit />
    </Suspense>
  );
}

function PreviewUnit() {
  const supabase = useRef(supabaseBrowser()).current;
  const router = useRouter();
  const params = useSearchParams();
  const unitId = params.get('id');
  const [unit, setUnit] = useState(null);

  // In-memory only — a teacher trying a drill here never writes to the
  // `progress` table, so it can't be confused with a real student's record.
  const [localHist, setLocalHist] = useState({});

  useEffect(() => {
    if (!unitId) return;
    supabase.from('units').select('*').eq('id', unitId).single().then(({ data }) => setUnit(data || null));
  }, [unitId]);

  function histFor(drillType, itemKey) {
    return localHist[`${drillType}:${itemKey}`] || [];
  }

  async function recordAttempt(drillType, itemKey, ok) {
    const key = `${drillType}:${itemKey}`;
    const prev = localHist[key] || [];
    const hist = [...prev, ok].slice(-5);
    setLocalHist((h) => ({ ...h, [key]: hist }));
    return hist;
  }

  if (!unitId) return <main style={{ padding: 32, color: 'var(--muted)' }}>No unit specified.</main>;
  if (!unit) return <main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>;

  return (
    <UnitDrill
      unit={unit}
      onBack={() => router.push('/dashboard/units')}
      histFor={histFor}
      recordAttempt={recordAttempt}
      readOnlyBanner="Teacher preview — your answers here aren't saved to any student's progress"
    />
  );
}

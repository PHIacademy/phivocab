'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '../../../../lib/supabaseBrowser';

const emptyWord = { pos: '', word: '', def: '', zh: '', ex: '' };
const emptyBlank = { sentence: '', answer: '' };

const inputStyle = { width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };
const btnStyle = { fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', padding: '7px 12px' };
const primaryBtn = { ...btnStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' };
const smallBtn = { ...btnStyle, padding: '4px 9px', fontSize: 12 };
const card = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 };

export default function UnitBuilderPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>}>
      <UnitBuilderForm />
    </Suspense>
  );
}

function UnitBuilderForm() {
  const supabase = useRef(supabaseBrowser()).current;
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');

  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [eyebrow, setEyebrow] = useState('');
  const [summary, setSummary] = useState('');
  const [order, setOrder] = useState(1);
  const [zhGloss, setZhGloss] = useState('');
  const [structNote, setStructNote] = useState('');
  const [words, setWords] = useState([{ ...emptyWord }]);
  const [blanks, setBlanks] = useState([{ ...emptyBlank }]);
  const [structurePieces, setStructurePieces] = useState(['']);
  const [structureSkeleton, setStructureSkeleton] = useState(['Subject', 'who-clause (describes subject)', 'main verb', 'rest of sentence']);
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    supabase.from('cohorts').select('*').then(({ data }) => setCohorts(data || []));
  }, []);

  useEffect(() => {
    if (!editId) return;
    supabase.from('units').select('*').eq('id', editId).single().then(({ data }) => {
      if (!data) return;
      setId(data.id);
      setTitle(data.title || '');
      setEyebrow(data.eyebrow || '');
      setSummary(data.summary || '');
      setOrder(data.order || 1);
      setZhGloss(data.zh_gloss || '');
      setStructNote(data.struct_note || '');
      setWords(data.words?.length ? data.words : [{ ...emptyWord }]);
      setBlanks(data.blanks?.length ? data.blanks : [{ ...emptyBlank }]);
      setStructurePieces(data.structure_pieces?.length ? data.structure_pieces : ['']);
      setStructureSkeleton(data.structure_skeleton?.length ? data.structure_skeleton : ['']);
      setCohortId(data.cohort_id || '');
      setLoaded(true);
    });
  }, [editId]);

  function updateWord(i, field, value) {
    setWords((w) => w.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function updateBlank(i, field, value) {
    setBlanks((b) => b.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function updatePiece(i, value) {
    setStructurePieces((p) => p.map((row, idx) => (idx === i ? value : row)));
  }
  function updateSkeletonTag(i, value) {
    setStructureSkeleton((s) => s.map((row, idx) => (idx === i ? value : row)));
  }

  async function save() {
    setError('');
    if (!id.trim()) return setError('Unit id (slug) is required, e.g. "unit-2".');
    if (!title.trim()) return setError('Title is required.');
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      id: id.trim(),
      title: title.trim(),
      eyebrow,
      summary,
      order: Number(order) || 0,
      zh_gloss: zhGloss,
      struct_note: structNote,
      words: words.filter((w) => w.word.trim()),
      blanks: blanks.filter((b) => b.sentence.trim() && b.answer.trim()),
      structure_pieces: structurePieces.filter((p) => p.trim()),
      structure_skeleton: structureSkeleton.filter((s) => s.trim()),
      cohort_id: cohortId || null,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('units').upsert(payload, { onConflict: 'id' });
    setSaving(false);
    if (error) return setError(error.message);
    router.push('/dashboard/units');
  }

  if (!loaded) return <main style={{ padding: 32, color: 'var(--muted)' }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 80px' }}>
      <Link href="/dashboard/units" style={{ fontSize: 13, color: 'var(--accent)' }}>← Units</Link>
      <h1 style={{ fontSize: 24, margin: '6px 0 20px' }}>{editId ? 'Edit unit' : 'New unit'}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={card}>
          <Field label="Unit id (slug — unique, can't change later)">
            <input style={inputStyle} value={id} onChange={(e) => setId(e.target.value)} disabled={!!editId} placeholder="unit-2" />
          </Field>
          <Field label="Title"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Passage title" /></Field>
          <Field label="Eyebrow (small label above title)"><input style={inputStyle} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} /></Field>
          <Field label="Summary"><input style={inputStyle} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Order (display sequence)"><input style={inputStyle} type="number" value={order} onChange={(e) => setOrder(e.target.value)} /></Field>
            <Field label="Cohort (blank = visible to everyone)">
              <select style={inputStyle} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
                <option value="">All cohorts</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Vocabulary ({words.length})</h3>
          {words.map((w, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={inputStyle} placeholder="pos (n./v./adj.)" value={w.pos} onChange={(e) => updateWord(i, 'pos', e.target.value)} />
                <input style={inputStyle} placeholder="word" value={w.word} onChange={(e) => updateWord(i, 'word', e.target.value)} />
              </div>
              <input style={inputStyle} placeholder="English definition" value={w.def} onChange={(e) => updateWord(i, 'def', e.target.value)} />
              <input style={inputStyle} placeholder="Chinese meaning" value={w.zh} onChange={(e) => updateWord(i, 'zh', e.target.value)} />
              <input style={inputStyle} placeholder="Example sentence" value={w.ex} onChange={(e) => updateWord(i, 'ex', e.target.value)} />
              <button style={smallBtn} onClick={() => setWords((ws) => ws.filter((_, idx) => idx !== i))}>Remove</button>
            </div>
          ))}
          <button style={btnStyle} onClick={() => setWords((ws) => [...ws, { ...emptyWord }])}>+ Add word</button>
        </div>

        <div style={card}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Fill-in-the-blank sentences ({blanks.length})</h3>
          {blanks.map((b, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input style={inputStyle} placeholder="Sentence with ______ for the blank" value={b.sentence} onChange={(e) => updateBlank(i, 'sentence', e.target.value)} />
              <input style={inputStyle} placeholder="Answer" value={b.answer} onChange={(e) => updateBlank(i, 'answer', e.target.value)} />
              <button style={smallBtn} onClick={() => setBlanks((bs) => bs.filter((_, idx) => idx !== i))}>Remove</button>
            </div>
          ))}
          <button style={btnStyle} onClick={() => setBlanks((bs) => [...bs, { ...emptyBlank }])}>+ Add sentence</button>
        </div>

        <div style={card}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Sentence-build drill</h3>
          <Field label="Chinese gloss of the target sentence"><input style={inputStyle} value={zhGloss} onChange={(e) => setZhGloss(e.target.value)} /></Field>
          <Field label="Hint note shown to students"><input style={inputStyle} value={structNote} onChange={(e) => setStructNote(e.target.value)} /></Field>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Sentence chunks, in correct order ({structurePieces.length})</div>
          {structurePieces.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input style={inputStyle} value={p} onChange={(e) => updatePiece(i, e.target.value)} placeholder={`Chunk ${i + 1}`} />
              <button style={smallBtn} onClick={() => setStructurePieces((ps) => ps.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
          <button style={btnStyle} onClick={() => setStructurePieces((ps) => [...ps, ''])}>+ Add chunk</button>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 8 }}>Skeleton labels shown above the drill</div>
          {structureSkeleton.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input style={inputStyle} value={s} onChange={(e) => updateSkeletonTag(i, e.target.value)} />
              <button style={smallBtn} onClick={() => setStructureSkeleton((ss) => ss.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
          <button style={btnStyle} onClick={() => setStructureSkeleton((ss) => [...ss, ''])}>+ Add label</button>
        </div>

        {error && <p style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={primaryBtn} disabled={saving} onClick={save}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Create unit'}</button>
          <Link href="/dashboard/units" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

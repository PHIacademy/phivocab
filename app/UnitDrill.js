'use client';
// Shared unit-drill rendering, used by both the student /drill page and the
// teacher's read-only unit preview. histFor/recordAttempt are passed in so
// the caller decides whether attempts are persisted (students) or kept
// purely in memory and thrown away (teacher preview).
import { useEffect, useState } from 'react';

export function isMastered(hist) {
  return !!hist && hist.length === 5 && hist.every((v) => v === true);
}
export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

export function Dots({ hist }) {
  const arr = hist || [];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 9, height: 9, borderRadius: '50%',
            background: arr[i] === true ? 'var(--good)' : arr[i] === false ? 'var(--bad)' : 'var(--line)',
          }}
        />
      ))}
    </div>
  );
}

export function UnitDrill({ unit, onBack, histFor, recordAttempt, readOnlyBanner }) {
  const words = unit.words || [];
  const blanks = unit.blanks || [];
  const pieces = (unit.structure_pieces || []).map((text, i) => ({ text, id: i }));

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 60px', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <header>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 13, marginBottom: 8 }}>
          ← All units
        </button>
        {readOnlyBanner && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', display: 'inline-block', padding: '4px 10px', borderRadius: 999, marginBottom: 10 }}>
            {readOnlyBanner}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          {unit.eyebrow}
        </div>
        <h1 style={{ fontSize: 26, margin: '4px 0' }}>{unit.title}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{unit.summary}</p>
      </header>

      <FlashcardDeck words={words} />
      <RecallDeck words={words} histFor={histFor} recordAttempt={recordAttempt} />
      <BlankDrill blanks={blanks} histFor={histFor} recordAttempt={recordAttempt} />
      {pieces.length > 0 && (
        <StructureDrill
          pieces={pieces}
          zhGloss={unit.zh_gloss}
          structNote={unit.struct_note}
          skeleton={unit.structure_skeleton || []}
        />
      )}
    </main>
  );
}

function Section({ title, right, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: 19, margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{right}</span>
      </div>
      {children}
    </section>
  );
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
  padding: '28px 24px', minHeight: 220, display: 'flex', flexDirection: 'column',
  justifyContent: 'center', gap: 14,
};
const btnStyle = { fontSize: 13.5, fontWeight: 600, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', padding: '9px 14px' };
const primaryBtn = { ...btnStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' };

function FlashcardDeck({ words }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (words.length === 0) return null;
  const w = words[idx];

  return (
    <Section title="Flashcards" right={`${idx + 1} / ${words.length}`}>
      <div style={cardStyle} onClick={() => setFlipped(!flipped)}>
        {!flipped ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>{w.pos}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600 }}>{w.word}</div>
              <SayBtn word={w.word} />
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Tap to reveal the meaning</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase' }}>{w.pos}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600 }}>{w.word}</div>
              <SayBtn word={w.word} />
            </div>
            <div style={{ fontSize: 15 }}>{w.def}</div>
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>{w.zh}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', borderLeft: '2px solid var(--accent-soft)', paddingLeft: 12 }}>"{w.ex}"</div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnStyle} disabled={idx === 0} onClick={() => { setIdx(idx - 1); setFlipped(false); }}>← Prev</button>
        <button style={primaryBtn} onClick={() => setFlipped(!flipped)}>Flip</button>
        <button style={btnStyle} disabled={idx === words.length - 1} onClick={() => { setIdx(idx + 1); setFlipped(false); }}>Next →</button>
      </div>
    </Section>
  );
}

function SayBtn({ word }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(word); }}
      aria-label="Pronounce word"
      style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--surface)' }}
    >
      🔊
    </button>
  );
}

function RecallDeck({ words, histFor, recordAttempt }) {
  const [activeWords, setActiveWords] = useState([]);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState({ text: '', ok: null });
  const [hist, setHist] = useState([]);

  useEffect(() => {
    const active = words.filter((w) => !isMastered(histFor('recall', w.word)));
    setActiveWords(active);
    setOrder(shuffle(active.map((_, i) => i)));
    setIdx(0);
  }, [words]);

  useEffect(() => {
    if (activeWords.length === 0) return;
    const w = activeWords[order[idx]];
    if (w) setHist(histFor('recall', w.word));
    setInput('');
    setFeedback({ text: '', ok: null });
  }, [idx, order, activeWords]);

  if (words.length > 0 && activeWords.length === 0) {
    return (
      <Section title="Chinese → English" right="">
        <div style={{ ...cardStyle, background: 'var(--good-soft)', border: '1px solid var(--good)', textAlign: 'center', color: 'var(--good)', fontWeight: 600 }}>
          🎉 All words mastered — 5 correct in a row, every time.
        </div>
      </Section>
    );
  }
  if (activeWords.length === 0) return null;

  const w = activeWords[order[idx]];

  async function check() {
    const val = input.trim().toLowerCase();
    const ok = val.length > 0 && val === w.word.toLowerCase();
    const newHist = await recordAttempt('recall', w.word, ok);
    setHist(newHist);
    if (isMastered(newHist)) {
      setFeedback({ text: '✓ mastered — moving on…', ok: true });
      setTimeout(() => {
        const active = words.filter((x) => !isMastered(histFor('recall', x.word)));
        setActiveWords(active);
        setOrder(shuffle(active.map((_, i) => i)));
        setIdx(0);
      }, 800);
    } else {
      setFeedback({ text: ok ? '✓ correct' : '✗ not quite', ok });
    }
  }

  return (
    <Section title="Chinese → English" right={`${idx + 1} / ${activeWords.length}`}>
      <div style={cardStyle}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600 }}>{w.zh}</div>
        <Dots hist={hist} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } }}
            placeholder="type the English word"
            style={{ flex: 1, minWidth: 0, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
          />
          <button style={primaryBtn} onClick={check}>Check</button>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: feedback.ok ? 'var(--good)' : feedback.ok === false ? 'var(--bad)' : 'transparent' }}>
          {feedback.text || ' '}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnStyle} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Prev</button>
        <button style={btnStyle} disabled={idx === activeWords.length - 1} onClick={() => setIdx(idx + 1)}>Next →</button>
      </div>
    </Section>
  );
}

function BlankDrill({ blanks, histFor, recordAttempt }) {
  const [activeIdx, setActiveIdx] = useState([]);
  const [values, setValues] = useState({});
  const [results, setResults] = useState({});

  useEffect(() => {
    const active = blanks
      .map((_, i) => i)
      .filter((i) => !isMastered(histFor('blank', blanks[i].sentence)));
    setActiveIdx(shuffle(active));
    setValues({});
    setResults({});
  }, [blanks]);

  if (blanks.length > 0 && activeIdx.length === 0) {
    return (
      <Section title="Fill in the blank" right="">
        <div style={{ background: 'var(--good-soft)', border: '1px solid var(--good)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--good)', fontWeight: 600 }}>
          🎉 All sentences mastered.
        </div>
      </Section>
    );
  }
  if (activeIdx.length === 0) return null;

  async function checkAll() {
    const masteredNow = [];
    for (const i of activeIdx) {
      const b = blanks[i];
      const val = (values[i] || '').trim().toLowerCase();
      if (val.length === 0) continue;
      const ok = val === b.answer.toLowerCase();
      const hist = await recordAttempt('blank', b.sentence, ok);
      setResults((r) => ({ ...r, [i]: { ok, hist } }));
      if (isMastered(hist)) masteredNow.push(i);
    }
    if (masteredNow.length) {
      setTimeout(() => {
        setActiveIdx((cur) => cur.filter((i) => !masteredNow.includes(i)));
      }, 800);
    }
  }

  return (
    <Section title="Fill in the blank" right="type the word, then check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeIdx.map((i) => {
          const b = blanks[i];
          const r = results[i];
          return (
            <div
              key={i}
              style={{
                background: 'var(--surface)', border: '1px solid ' + (r ? (r.ok ? 'var(--good)' : 'var(--bad)') : 'var(--line)'),
                borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{b.sentence.replace('______', '＿＿＿＿＿＿')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={values[i] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [i]: e.target.value }))}
                  placeholder={b.answer.slice(0, 3) + '…'}
                  style={{ flex: 1, minWidth: 0, fontSize: 15, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: r ? (r.ok ? 'var(--good)' : 'var(--bad)') : 'transparent' }}>
                {r ? (r.ok ? '✓ correct' : '✗ answer: ' + b.answer) : ' '}
              </div>
              <Dots hist={r ? r.hist : histFor('blank', b.sentence)} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={primaryBtn} onClick={checkAll}>Check all</button>
        <button style={btnStyle} onClick={() => { setValues({}); setResults({}); }}>Reset</button>
      </div>
    </Section>
  );
}

function StructureDrill({ pieces, zhGloss, structNote, skeleton }) {
  const [placed, setPlaced] = useState([]);
  const [bank, setBank] = useState(shuffle(pieces.map((p) => p.id)));
  const [feedback, setFeedback] = useState('');
  const correctOrder = pieces.map((p) => p.id);

  function place(id) {
    setPlaced([...placed, id]);
    setFeedback('');
  }
  function remove(id) {
    setPlaced(placed.filter((p) => p !== id));
    setFeedback('');
  }
  function check() {
    const ok = placed.length === correctOrder.length && placed.every((v, i) => v === correctOrder[i]);
    setFeedback(ok ? '✓ Correct order.' : placed.length < correctOrder.length ? `Keep going — ${correctOrder.length - placed.length} left.` : '✗ Not quite — remove a chip and try again.');
  }
  function reset() {
    setPlaced([]);
    setBank(shuffle(pieces.map((p) => p.id)));
    setFeedback('');
  }

  const chipStyle = { fontSize: 14, padding: '7px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' };

  return (
    <Section title="Build the sentence" right="structure drill">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13.5, color: 'var(--muted)', borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>{zhGloss}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {skeleton.map((t, i) => (
            <span key={i} style={{ padding: '3px 9px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, fontSize: 12.5 }}>{t}</span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)' }}>{structNote}</p>
        <div style={{ minHeight: 48, border: '1px dashed var(--line)', borderRadius: 10, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {placed.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>Tap chips below to build the sentence here</span>}
          {placed.map((id) => (
            <span key={id} style={chipStyle} onClick={() => remove(id)}>{pieces[id].text}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {bank.filter((id) => !placed.includes(id)).map((id) => (
            <span key={id} style={chipStyle} onClick={() => place(id)}>{pieces[id].text}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={primaryBtn} onClick={check}>Check order</button>
          <button style={btnStyle} onClick={reset}>Reset</button>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: feedback.startsWith('✓') ? 'var(--good)' : 'var(--bad)' }}>{feedback}</div>
      </div>
    </Section>
  );
}

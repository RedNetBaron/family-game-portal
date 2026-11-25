import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useMemo, useState } from 'react';
import { familyDay } from '../../../functions/shared/scoring.js';
import { db, functions } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { useNow } from '../../lib/useNow';

const LENGTH = 5;
const MAX = 6;
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const EMOJI: Record<string, string> = { c: '🟧', p: '🟨', a: '⬛' };

type MyPlay = { guesses: string[]; marks: string[]; solved: boolean; done: boolean; answer?: string; points?: number; streak?: number };
type Score = { uid: string; name: string; solved: boolean; guesses: number; points: number; streak: number; pattern: string[] };

const guessFn = httpsCallable<{ guess: string }, MyPlay>(functions, 'dailyGuess');

export function DailyWord({ member }: { member: Member }) {
  const now = useNow(30_000);
  const day = familyDay(now);
  const [play, setPlay] = useState<MyPlay | null | undefined>(undefined);
  const [scores, setScores] = useState<Score[]>([]);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setPlay(undefined);
    return onSnapshot(
      doc(db, 'dailyPlays', `${day}_${member.uid}`),
      (snap) => setPlay(snap.exists() ? (snap.data() as MyPlay) : null),
      () => setPlay(null),
    );
  }, [day, member.uid]);

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'dailyScores'), where('day', '==', day)), (snap) =>
        setScores(snap.docs.map((d) => d.data() as Score)),
      () => undefined),
    [day],
  );

  const guesses = play?.guesses ?? [];
  const marks = play?.marks ?? [];
  const done = !!play?.done;

  // Best mark seen for each letter, for the keyboard colors.
  const keyMarks = useMemo(() => {
    const rank: Record<string, number> = { a: 1, p: 2, c: 3 };
    const out: Record<string, string> = {};
    guesses.forEach((g, i) =>
      [...g].forEach((ch, j) => {
        const m = marks[i]?.[j];
        if (m && (!out[ch] || rank[m] > rank[out[ch]])) out[ch] = m;
      }),
    );
    return out;
  }, [guesses, marks]);

  async function submit() {
    if (busy || done) return;
    if (typed.length !== LENGTH) {
      setError('Five letters, please.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await guessFn({ guess: typed });
      setPlay(res.data);
      setTyped('');
    } catch (e) {
      const msg = (e as { message?: string }).message || '';
      setError(msg.includes('word list') ? 'Not in the word list.' : msg.includes('already') ? 'You already finished today.' : "Couldn't check that guess. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    if (done || busy) return;
    setError('');
    if (key === 'enter') submit();
    else if (key === 'back') setTyped((t) => t.slice(0, -1));
    else if (/^[a-z]$/.test(key)) setTyped((t) => (t.length < LENGTH ? t + key : t));
  }

  // Physical keyboard too (desktop, tablets with keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') press('enter');
      else if (e.key === 'Backspace') press('back');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function share() {
    const grid = marks.map((m) => [...m].map((c) => EMOJI[c]).join('')).join('\n');
    const result = play?.solved ? `${guesses.length}/${MAX}` : `X/${MAX}`;
    await addDoc(collection(db, 'messages'), {
      uid: member.uid,
      name: member.name,
      text: `Daily Word ${day.slice(5).replace('-', '/')}: ${result}${play?.streak ? ` · 🔥${play.streak}` : ''}\n${grid}`,
      createdAt: serverTimestamp(),
    });
    setShared(true);
  }

  if (play === undefined) return <p className="center">Loading today's word…</p>;

  const rows = Array.from({ length: MAX }, (_, i) => {
    if (i < guesses.length) return { letters: guesses[i], marks: marks[i] };
    if (i === guesses.length && !done) return { letters: typed, marks: '' };
    return { letters: '', marks: '' };
  });
  const others = scores.filter((s) => s.uid !== member.uid);

  return (
    <section className="dw">
      <header className="lg-head">
        <a href="#/games" className="link">‹ Games</a>
        <h2>Daily Word</h2>
        <span className="badge">{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </header>
      {!guesses.length && <p className="hint center-text">Guess today's 5-letter word in 6 tries. Everyone in the family gets the same word, and it changes at midnight Central.</p>}

      <div className="dw-grid" aria-label="Your guesses">
        {rows.map((r, i) => (
          <div key={i} className="dw-row">
            {Array.from({ length: LENGTH }, (_, j) => (
              <span key={j} className={`dw-tile ${r.marks[j] ?? ''} ${r.letters[j] && !r.marks ? 'typed' : ''}`}>
                {r.letters[j] ?? ''}
              </span>
            ))}
          </div>
        ))}
      </div>

      {error && <p className="error center-text">{error}</p>}
      {!done && !error && typed.length === LENGTH && !busy && <p className="hint center-text">Tap Enter to check your word.</p>}

      {done ? (
        <div className="card dw-done">
          <h3>{play?.solved ? `Got it in ${guesses.length}! 🎉` : `The word was ${play?.answer?.toUpperCase()}`}</h3>
          <p>
            +{play?.points} points{(play?.streak ?? 0) > 1 ? ` · 🔥 ${play?.streak}-day streak` : ''}
          </p>
          <button className="primary" onClick={share} disabled={shared}>
            {shared ? 'Shared to chat ✓' : 'Share my result in the chat'}
          </button>
          <p className="hint">Sharing shows only the colored squares, not your letters.</p>
        </div>
      ) : (
        <div className="dw-keys" aria-label="Keyboard">
          {ROWS.map((row, i) => (
            <div key={row} className="dw-keyrow">
              {i === 2 && (
                <button className={`dw-key wide ${typed.length === LENGTH ? 'go' : ''}`} onClick={() => press('enter')} disabled={busy}>
                  {busy ? 'Checking…' : 'Enter'}
                </button>
              )}
              {[...row].map((k) => (
                <button key={k} className={`dw-key ${keyMarks[k] ?? ''}`} onClick={() => press(k)}>
                  {k}
                </button>
              ))}
              {i === 2 && <button className="dw-key wide" onClick={() => press('back')} aria-label="Delete">⌫</button>}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Family today</h3>
        {!others.length ? (
          <p className="hint">Nobody else has finished yet.</p>
        ) : !done ? (
          <p className="hint">{others.length} {others.length === 1 ? 'person has' : 'people have'} finished. Their results show once you're done.</p>
        ) : (
          <ul className="dw-family">
            {others
              .sort((a, b) => Number(b.solved) - Number(a.solved) || a.guesses - b.guesses)
              .map((s) => (
                <li key={s.uid}>
                  <span className="who">{s.name}</span>
                  <span className="hint">{s.solved ? `${s.guesses}/${MAX}` : 'X'}{s.streak ? ` 🔥${s.streak}` : ''}</span>
                  <span className="dw-mini">{s.pattern.map((m) => [...m].map((c) => EMOJI[c]).join('')).join('\n')}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

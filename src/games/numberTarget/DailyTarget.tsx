import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bestSolution, DAILY_SECONDS, OP_SYMBOL, parseStep } from '../../../functions/shared/numbers.js';
import { familyDay } from '../../../functions/shared/scoring.js';
import { db, functions } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { useNow } from '../../lib/useNow';
import { NumberBoard } from './NumberBoard';

type MyPlay = {
  numbers: number[];
  target: number;
  startedAt: Timestamp;
  done: boolean;
  best?: number;
  distance?: number;
  points?: number;
  seconds?: number;
  steps?: string[];
  late?: boolean;
};
type Score = { uid: string; name: string; game?: string; best: number; distance: number; points: number; seconds: number };

const call = httpsCallable<{ action: 'start' | 'submit'; day?: string; steps?: string[] }, { serverNow?: number; startedAt?: number }>(functions, 'dailyTarget');

export function DailyTarget({ member }: { member: Member }) {
  const now = useNow(250);
  const today = familyDay(now);
  // Stay on the day you started, even if midnight passes mid-puzzle.
  const [day, setDay] = useState(today);
  const [play, setPlay] = useState<MyPlay | null | undefined>(undefined);
  const [scores, setScores] = useState<Score[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [skew, setSkew] = useState(0);
  const [shared, setShared] = useState(false);
  // Reading your own play is refused until it exists, which ends the listener, so listen again after each call.
  const [listen, setListen] = useState(0);
  const steps = useRef<string[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    if (play === null && day !== today) setDay(today);
  }, [play, day, today]);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'dailyPlays', `dt_${day}_${member.uid}`),
      (snap) => setPlay(snap.exists() ? (snap.data() as MyPlay) : null),
      () => setPlay(null),
    );
  }, [day, member.uid, listen]);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'dailyScores'), where('day', '==', day)),
        (snap) => setScores(snap.docs.map((d) => d.data() as Score).filter((s) => s.game === 'dailyTarget')),
        () => undefined,
      ),
    [day],
  );

  async function start() {
    setBusy(true);
    setError('');
    try {
      const sent = Date.now();
      const res = await call({ action: 'start' });
      if (res.data.serverNow) setSkew(res.data.serverNow - (sent + Date.now()) / 2);
      setListen((n) => n + 1);
    } catch {
      setError("Couldn't start today's puzzle. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError('');
    try {
      await call({ action: 'submit', day, steps: steps.current });
      setListen((n) => n + 1);
    } catch (e) {
      const msg = (e as { message?: string }).message || '';
      if (!msg.includes('already')) {
        submitted.current = false;
        setError("Couldn't turn in your answer. Tap Lock in to try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const startedAt = play?.startedAt ? play.startedAt.toMillis() - skew : null;
  const deadline = startedAt !== null ? startedAt + DAILY_SECONDS * 1000 : null;
  const left = deadline !== null ? Math.max(0, (deadline - now) / 1000) : DAILY_SECONDS;
  const playing = !!play && !play.done;

  useEffect(() => {
    if (playing && deadline !== null && now > deadline) submit();
  });

  const solution = useMemo(() => (play?.done ? bestSolution(play.numbers, play.target) : null), [play]);

  async function share() {
    if (!play?.done) return;
    const how = play.distance === 0 ? `hit ${play.target} exactly 🎯 in ${play.seconds}s` : `got within ${play.distance} of ${play.target}`;
    await addDoc(collection(db, 'messages'), {
      uid: member.uid,
      name: member.name,
      text: `Daily Target ${day.slice(5).replace('-', '/')}: I ${how}. +${play.points} points`,
      createdAt: serverTimestamp(),
    });
    setShared(true);
  }

  if (play === undefined) return <p className="center">Loading today's puzzle…</p>;
  const others = scores.filter((s) => s.uid !== member.uid);

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/number-target" className="link">‹ Number Target</a>
        <h2>Daily Target</h2>
        <span className="badge">{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </header>

      {!play ? (
        <div className="card lg-lobby">
          <h3>Today's puzzle</h3>
          <p>
            Everyone in the family gets the same six numbers and target today. You have <strong>2 minutes</strong> once you
            start, and you only get one try, so start when you're ready.
          </p>
          <p className="hint">
            Tap a number, then + − × or ÷, then another number. The answer becomes a new number you can keep using. Whole
            numbers only. Points: exact = 5, within 5 = 4, within 10 = 3, within 25 = 2, anything else = 1.
          </p>
          <button className="primary" disabled={busy} onClick={start}>
            {busy ? 'Starting…' : 'Start my 2 minutes'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      ) : playing ? (
        <section className="tq">
          <div className="tq-bar" aria-hidden="true">
            <div style={{ width: `${(left / DAILY_SECONDS) * 100}%` }} className={left < 15 ? 'urgent' : ''} />
          </div>
          {startedAt !== null && (
            <NumberBoard numbers={play.numbers} target={play.target} startedAt={startedAt} onSteps={(s) => (steps.current = s)} onLock={submit} />
          )}
          <p className="tq-feedback">{busy || left <= 0 ? 'Checking your answer…' : `${Math.ceil(left)}s`}</p>
          {error && <p className="error center-text">{error}</p>}
        </section>
      ) : (
        <div className="card dw-done">
          <div className="nt-target small">
            <small>Target</small>
            <span>{play.target}</span>
          </div>
          <h3>
            {play.late
              ? "Time ran out before your answer came in."
              : play.distance === 0
                ? `Bullseye in ${play.seconds}s! 🎯`
                : `You made ${play.best}, ${play.distance} away`}
          </h3>
          <p>+{play.points} {play.points === 1 ? 'point' : 'points'}</p>
          {!!play.steps?.length && (
            <p className="hint">
              Your steps:{' '}
              {play.steps.map((s) => parseStep(s)).filter(Boolean).map((s) => `${s!.a} ${OP_SYMBOL[s!.op]} ${s!.b}`).join(' · ')}
            </p>
          )}
          {solution && (
            <p className="hint">
              {solution.distance === 0 ? 'One way to hit it: ' : `Closest possible: `}
              <strong>
                {solution.expression} = {solution.value}
              </strong>
            </p>
          )}
          <button className="primary" onClick={share} disabled={shared}>
            {shared ? 'Shared to chat ✓' : 'Share my result in the chat'}
          </button>
          <p className="hint">Sharing doesn't give away the numbers.</p>
        </div>
      )}

      <div className="card">
        <h3>Family today</h3>
        {!others.length ? (
          <p className="hint">Nobody else has finished yet.</p>
        ) : !play?.done ? (
          <p className="hint">
            {others.length} {others.length === 1 ? 'person has' : 'people have'} finished. Their results show once you're done.
          </p>
        ) : (
          <ol className="lg-standings">
            {others
              .sort((a, b) => a.distance - b.distance || a.seconds - b.seconds)
              .map((s) => (
                <li key={s.uid}>
                  <span className="who">{s.name}</span>
                  <span className="hint">{s.distance === 0 ? `🎯 ${s.seconds}s` : `${s.best} (${s.distance} away)`}</span>
                  <span className="pts">+{s.points}</span>
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}

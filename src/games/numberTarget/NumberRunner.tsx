import { useEffect, useMemo, useRef, useState } from 'react';
import { bestSolution, type Puzzle } from '../../../functions/shared/numbers.js';
import { NumberBoard } from './NumberBoard';
import { encodeRound, REVEAL_SECONDS, roundResult } from './logic';

type Props = {
  puzzles: Puzzle[];
  perRound: number;
  /** Hard stop for the whole game (ms). */
  deadline: number;
  initial: string[];
  onRound: (rounds: string[]) => void;
  onFinish: (rounds: string[]) => void;
};

export function NumberRunner({ puzzles, perRound, deadline, initial, onRound, onFinish }: Props) {
  const [rounds, setRounds] = useState<string[]>(initial.slice(0, puzzles.length));
  const [index, setIndex] = useState(Math.min(initial.length, puzzles.length));
  const [roundStart, setRoundStart] = useState(Date.now());
  const [revealing, setRevealing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const roundsRef = useRef(rounds);
  const stepsRef = useRef<string[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  function finish(final: string[]) {
    if (finished.current) return;
    finished.current = true;
    onFinish(final);
  }

  function lock() {
    if (revealing || finished.current || index >= puzzles.length || roundsRef.current.length > index) return;
    const next = [...roundsRef.current, encodeRound(stepsRef.current)];
    roundsRef.current = next;
    setRounds(next);
    setRevealing(true);
    onRound(next);
    setTimeout(() => {
      setRevealing(false);
      stepsRef.current = [];
      if (next.length >= puzzles.length) finish(next);
      else {
        setIndex(next.length);
        setRoundStart(Date.now());
      }
    }, REVEAL_SECONDS * 1000);
  }

  const left = Math.max(0, perRound - (now - roundStart) / 1000);

  useEffect(() => {
    if (!revealing && left <= 0 && index < puzzles.length) lock();
  });
  useEffect(() => {
    if (now > deadline) finish(roundsRef.current);
  });
  useEffect(() => {
    if (index >= puzzles.length) finish(roundsRef.current);
  }, [index, puzzles.length]);

  const p = puzzles[Math.min(index, puzzles.length - 1)];
  const solution = useMemo(() => (revealing ? bestSolution(p.numbers, p.target) : null), [revealing, p]);

  if (index >= puzzles.length) return <p className="center">Turning in your answers…</p>;

  const score = rounds.reduce((s, r, i) => s + roundResult(puzzles[i], r, perRound).points, 0);
  const mine = revealing ? roundResult(p, rounds[index], perRound) : null;

  return (
    <section className="tq">
      <div className="tq-top">
        <span className="hint">
          Round {index + 1} of {puzzles.length}
        </span>
        <span className="tq-score">{score} pts</span>
      </div>
      <div className="tq-bar" aria-hidden="true">
        <div style={{ width: `${(revealing ? 0 : left / perRound) * 100}%` }} className={left < 8 ? 'urgent' : ''} />
      </div>
      {revealing && mine ? (
        <div className="card nt-reveal">
          <div className="nt-target small">
            <small>Target</small>
            <span>{p.target}</span>
          </div>
          <h3 className={mine.distance === 0 ? 'good' : ''}>
            {mine.distance === 0 ? `Bullseye! +${mine.points}` : `You made ${mine.best}, ${mine.distance} away · +${mine.points}`}
          </h3>
          {solution && (
            <p className="hint">
              {solution.distance === 0 ? 'One way: ' : `Closest possible was ${solution.value}: `}
              <strong>{solution.expression} = {solution.value}</strong>
            </p>
          )}
          <p className="hint">{index + 1 < puzzles.length ? 'Next round coming up…' : 'That was the last round.'}</p>
        </div>
      ) : (
        <>
          <NumberBoard
            key={index}
            numbers={p.numbers}
            target={p.target}
            startedAt={roundStart}
            onSteps={(s) => (stepsRef.current = s)}
            onLock={lock}
          />
          <p className="tq-feedback">{Math.ceil(left)}s</p>
        </>
      )}
    </section>
  );
}

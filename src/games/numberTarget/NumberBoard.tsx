import { useEffect, useMemo, useRef, useState } from 'react';
import { apply, OP_SYMBOL, replay, stepString, type Op } from '../../../functions/shared/numbers.js';

type UiStep = { i: number; j: number; a: number; op: Op; b: number; value: number; ms: number };

type Props = {
  numbers: number[];
  target: number;
  /** When this round's clock started (ms), for timing each step. */
  startedAt: number;
  /** Called with the steps (as stored) after every change. */
  onSteps: (steps: string[]) => void;
  /** Lock in now (button, or automatically on an exact hit). */
  onLock: () => void;
};

const OPS: Op[] = ['+', '-', 'x', '/'];

export function NumberBoard({ numbers, target, startedAt, onSteps, onLock }: Props) {
  const [steps, setSteps] = useState<UiStep[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [error, setError] = useState('');
  const locked = useRef(false);

  const slots = useMemo(() => {
    const s: (number | null)[] = [...numbers];
    for (const st of steps) {
      s[st.i] = null;
      s[st.j] = st.value;
    }
    return s;
  }, [numbers, steps]);

  const stored = steps.map((s) => stepString(s.a, s.op, s.b, s.ms));
  const result = replay(numbers, target, stored);
  const newest = steps.length ? steps[steps.length - 1].j : -1;

  useEffect(() => {
    onSteps(steps.map((s) => stepString(s.a, s.op, s.b, s.ms)));
    if (result.distance === 0 && !locked.current) {
      locked.current = true;
      setTimeout(onLock, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  function tapTile(t: number) {
    if (slots[t] === null || locked.current) return;
    setError('');
    if (first === null || op === null) {
      setFirst(first === t ? null : t);
      return;
    }
    if (t === first) {
      setFirst(null);
      setOp(null);
      return;
    }
    const x = slots[first]!;
    const y = slots[t]!;
    // Subtraction and division always go big-to-small so order doesn't trip anyone up.
    const [a, b] = (op === '-' || op === '/') && y > x ? [y, x] : [x, y];
    const value = apply(a, op, b);
    if (value === null) {
      setError(op === '/' ? `${a} ÷ ${b} isn't a whole number.` : 'That would be zero.');
      setOp(null);
      return;
    }
    setSteps([...steps, { i: first, j: t, a, op, b, value, ms: Date.now() - startedAt }]);
    setFirst(null);
    setOp(null);
  }

  function tapOp(o: Op) {
    if (first === null || locked.current) return;
    setError('');
    setOp(op === o ? null : o);
  }

  const closest = result.distance === 0 ? 'Bullseye! 🎯' : `Closest: ${result.best} (${result.distance} away)`;

  return (
    <div className="nt-board">
      <div className="nt-target" aria-label={`Target ${target}`}>
        <small>Target</small>
        <span>{target}</span>
      </div>
      <div className="nt-tiles">
        {slots.map((v, t) => (
          <button
            key={t}
            className={`nt-tile ${v === null ? 'used' : ''} ${first === t ? 'on' : ''} ${t === newest && v !== null ? 'new' : ''}`}
            disabled={v === null}
            onClick={() => tapTile(t)}
            aria-pressed={first === t}
          >
            {v ?? ''}
          </button>
        ))}
      </div>
      <div className="nt-ops">
        {OPS.map((o) => (
          <button key={o} className={`nt-op ${op === o ? 'on' : ''}`} disabled={first === null} onClick={() => tapOp(o)} aria-label={{ '+': 'plus', '-': 'minus', x: 'times', '/': 'divided by' }[o]}>
            {OP_SYMBOL[o]}
          </button>
        ))}
      </div>
      <p className={`nt-closest ${result.distance === 0 ? 'good' : ''}`} aria-live="polite">
        {error ? <span className="error">{error}</span> : first === null ? closest : op === null ? 'Now pick + − × or ÷' : `${slots[first]} ${OP_SYMBOL[op]} … tap another number`}
      </p>
      {steps.length > 0 && (
        <ol className="nt-steps">
          {steps.map((s, k) => (
            <li key={k}>
              {s.a} {OP_SYMBOL[s.op]} {s.b} = <strong>{s.value}</strong>
            </li>
          ))}
        </ol>
      )}
      <div className="nt-actions">
        <button className="link" disabled={!steps.length} onClick={() => { setSteps(steps.slice(0, -1)); setFirst(null); setOp(null); setError(''); }}>
          Undo
        </button>
        <button className="link" disabled={!steps.length} onClick={() => { setSteps([]); setFirst(null); setOp(null); setError(''); }}>
          Start over
        </button>
        <button className="primary small" onClick={() => { locked.current = true; onLock(); }}>
          Lock in {result.best}
        </button>
      </div>
    </div>
  );
}

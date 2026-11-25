import { useEffect, useRef, useState } from 'react';
import { answerOf, showProblem } from './logic';

type Props = {
  problems: string[];
  seconds: number;
  /** When time is up (ms). */
  deadline: number;
  initial: string[];
  onProgress: (answers: string[]) => void;
  onFinish: (answers: string[]) => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', '0', 'back'];

export function SprintRunner({ problems, seconds, deadline, initial, onProgress, onFinish }: Props) {
  const [answers, setAnswers] = useState<string[]>(initial);
  const [typed, setTyped] = useState('');
  const [flash, setFlash] = useState<'good' | 'bad' | ''>('');
  const [now, setNow] = useState(Date.now());
  const answersRef = useRef(answers);
  const finished = useRef(false);
  const lastSaved = useRef(initial.length);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onFinish(answersRef.current);
  }

  useEffect(() => {
    if (now > deadline || answersRef.current.length >= problems.length) finish();
  });

  const index = answers.length;
  const problem = problems[index];
  const answer = problem ? answerOf(problem) : 0;

  function record(entry: string) {
    const next = [...answersRef.current, entry];
    answersRef.current = next;
    setAnswers(next);
    setTyped('');
    // Save every few answers so a dropped connection doesn't lose much.
    if (next.length - lastSaved.current >= 5) {
      lastSaved.current = next.length;
      onProgress(next);
    }
  }

  function press(key: string) {
    if (finished.current || !problem) return;
    if (key === 'skip') {
      setFlash('');
      record('-');
      return;
    }
    if (key === 'back') {
      setTyped((t) => t.slice(0, -1));
      return;
    }
    const t = (typed + key).replace(/^0+(?=\d)/, '');
    if (Number(t) === answer) {
      setFlash('good');
      record(t);
      return;
    }
    // Once the answer is as long as the right one and still wrong, clear it.
    if (t.length >= String(answer).length) {
      setFlash('bad');
      setTyped('');
      return;
    }
    setFlash('');
    setTyped(t);
  }

  // Physical keyboard too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter' || e.key === ' ') press('skip');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 350);
    return () => clearTimeout(t);
  }, [flash, answers.length]);

  const left = Math.max(0, (deadline - now) / 1000);
  const right = answers.filter((a, i) => a !== '-' && Number(a) === answerOf(problems[i])).length;

  if (!problem || left <= 0) return <p className="center">Time! Turning in your answers…</p>;

  return (
    <section className="ms">
      <div className="tq-top">
        <span className="lg-timer">{Math.ceil(left)}s</span>
        <span className="tq-score">{right} right</span>
      </div>
      <div className="tq-bar" aria-hidden="true">
        <div style={{ width: `${(left / seconds) * 100}%` }} className={left < 10 ? 'urgent' : ''} />
      </div>
      <div className={`ms-problem ${flash}`} aria-live="polite">
        <span>{showProblem(problem)} =</span>
        <strong>{typed || '?'}</strong>
      </div>
      <div className="ms-keys">
        {KEYS.map((k) => (
          <button key={k} className={`ms-key ${k === 'skip' || k === 'back' ? 'fn' : ''}`} onClick={() => press(k)} aria-label={k === 'back' ? 'Delete' : k === 'skip' ? 'Skip' : k}>
            {k === 'back' ? '⌫' : k === 'skip' ? 'Skip' : k}
          </button>
        ))}
      </div>
    </section>
  );
}

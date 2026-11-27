import { useEffect, useRef, useState } from 'react';

type Props = {
  letter: string;
  categories: string[];
  deadline: number;
  initial: string[];
  onChange: (answers: string[]) => void;
  onFinish: (answers: string[]) => void;
};

export function AnswerSheet({ letter, categories, deadline, initial, onChange, onFinish }: Props) {
  const [answers, setAnswers] = useState<string[]>(() => categories.map((_, i) => initial[i] ?? ''));
  const [now, setNow] = useState(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const finished = useRef(false);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0 && !finished.current) {
      finished.current = true;
      onFinish(answersRef.current);
    }
  }, [left, onFinish]);

  function set(i: number, value: string) {
    const next = [...answersRef.current];
    next[i] = value.slice(0, 60);
    answersRef.current = next;
    setAnswers(next);
    onChange(next);
  }

  const filled = answers.filter((a) => a.trim()).length;

  return (
    <section className="cd-sheet">
      <div className="cd-top">
        <div className="cd-letter" aria-label={`Letter ${letter}`}>{letter}</div>
        <div className="cd-meta">
          <span className={left <= 15 ? 'lg-timer urgent' : 'lg-timer'}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </span>
          <span className="hint">
            {filled} of {categories.length} filled
          </span>
        </div>
      </div>
      <p className="hint">Every answer must start with <strong>{letter}</strong>. If every main word starts with it, each word scores a point. Answers someone else also gives score 0.</p>
      <ol className="cd-list">
        {categories.map((c, i) => (
          <li key={i}>
            <label>
              <span>{c}</span>
              <input
                value={answers[i]}
                onChange={(e) => set(i, e.target.value)}
                placeholder={`${letter}…`}
                autoCapitalize="words"
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint={i === categories.length - 1 ? 'done' : 'next'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = (e.currentTarget.closest('li')?.nextElementSibling as HTMLElement | null)?.querySelector('input');
                    if (next) next.focus();
                    else e.currentTarget.blur();
                  }
                }}
              />
            </label>
          </li>
        ))}
      </ol>
      <button
        className="primary"
        onClick={() => {
          let ok = true;
          try {
            ok = window.confirm('Turn in your answers now? You won’t be able to change them.');
          } catch {
            /* no dialogs */
          }
          if (ok && !finished.current) {
            finished.current = true;
            onFinish(answersRef.current);
          }
        }}
      >
        I'm done, turn in my answers
      </button>
    </section>
  );
}

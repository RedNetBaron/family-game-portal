import { useEffect, useRef, useState } from 'react';
import { answerPoints, decodeAnswer, encodeAnswer, REVEAL_SECONDS, type TriviaQuestion } from './logic';

type Props = {
  questions: TriviaQuestion[];
  perQuestion: number;
  /** Hard stop for the whole round (ms). */
  deadline: number;
  initial: string[];
  onAnswer: (answers: string[]) => void;
  onFinish: (answers: string[]) => void;
};

export function QuizRunner({ questions, perQuestion, deadline, initial, onAnswer, onFinish }: Props) {
  const [answers, setAnswers] = useState<string[]>(initial.slice(0, questions.length));
  const [index, setIndex] = useState(Math.min(initial.length, questions.length));
  const [shownAt, setShownAt] = useState(Date.now());
  const [revealing, setRevealing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const answersRef = useRef(answers);
  const finished = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  function finish(final: string[]) {
    if (finished.current) return;
    finished.current = true;
    onFinish(final);
  }

  function choose(choice: number) {
    if (revealing || finished.current || index >= questions.length) return;
    const ms = Math.min(Date.now() - shownAt, perQuestion * 1000);
    const next = [...answersRef.current, encodeAnswer(choice, ms)];
    answersRef.current = next;
    setAnswers(next);
    setRevealing(true);
    onAnswer(next);
    setTimeout(() => {
      setRevealing(false);
      if (next.length >= questions.length) finish(next);
      else {
        setIndex(next.length);
        setShownAt(Date.now());
      }
    }, REVEAL_SECONDS * 1000);
  }

  const left = Math.max(0, perQuestion - (now - shownAt) / 1000);

  // Out of time on this question.
  useEffect(() => {
    if (!revealing && left <= 0 && index < questions.length) choose(-1);
  });

  // Whole round is over (e.g. live game time is up).
  useEffect(() => {
    if (now > deadline) finish(answersRef.current);
  });

  // Coming back to a round that was already fully answered.
  useEffect(() => {
    if (index >= questions.length) finish(answersRef.current);
  }, [index, questions.length]);

  if (index >= questions.length) return <p className="center">Turning in your answers…</p>;

  const q = questions[index];
  const mine = revealing ? decodeAnswer(answers[index]) : null;
  const pts = mine ? answerPoints(q, mine, perQuestion) : 0;
  const score = answers.reduce((s, a, i) => s + answerPoints(questions[i], decodeAnswer(a), perQuestion), 0);

  return (
    <section className="tq">
      <div className="tq-top">
        <span className="hint">
          Question {index + 1} of {questions.length} · {q.category}
        </span>
        <span className="tq-score">{score} pts</span>
      </div>
      <div className="tq-bar" aria-hidden="true">
        <div style={{ width: `${(revealing ? 0 : left / perQuestion) * 100}%` }} className={left < 4 ? 'urgent' : ''} />
      </div>
      <h3 className="tq-question">{q.question}</h3>
      <div className="tq-choices">
        {q.choices.map((c, i) => {
          let cls = 'tq-choice';
          if (revealing) {
            if (i === q.answer) cls += ' right';
            else if (mine && i === mine.choice) cls += ' wrong';
            else cls += ' dim';
          }
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={revealing}>
              {c}
            </button>
          );
        })}
      </div>
      <p className={`tq-feedback ${revealing ? (pts ? 'good' : 'bad') : ''}`} aria-live="polite">
        {revealing ? (pts ? `Correct! +${pts}` : mine && mine.choice === -1 ? "Time's up!" : 'Not quite.') : `${Math.ceil(left)}s`}
      </p>
    </section>
  );
}

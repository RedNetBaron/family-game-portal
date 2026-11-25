import { BANK, type Category } from './questions';

export const QUESTION_COUNTS = [10, 15, 20];
export const PER_QUESTION_PRESETS = [10, 20, 30];
export const MIN_PER_QUESTION = 5;
export const MAX_PER_QUESTION = 60;
/** Pause after each answer to show whether it was right. */
export const REVEAL_SECONDS = 2;

export type TriviaQuestion = {
  category: Category;
  question: string;
  choices: string[];
  answer: number; // index into choices
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickQuestions(categories: Category[], count: number, rand: () => number = Math.random): TriviaQuestion[] {
  const pool = categories.flatMap((category) =>
    BANK[category].map(([question, right, w1, w2, w3]) => ({ category, question, right, wrong: [w1, w2, w3] })),
  );
  return shuffle(pool, rand)
    .slice(0, count)
    .map(({ category, question, right, wrong }) => {
      const choices = shuffle([right, ...wrong], rand);
      return { category, question, choices, answer: choices.indexOf(right) };
    });
}

/** Total time for a round: every question's timer plus the reveal pauses. */
export function roundSeconds(count: number, perQuestion: number): number {
  return count * (perQuestion + REVEAL_SECONDS);
}

/** A player's answer is stored as "choice:milliseconds", with choice -1 when time ran out. */
export function encodeAnswer(choice: number, ms: number): string {
  return `${choice}:${Math.round(ms)}`;
}

export function decodeAnswer(s: string | undefined): { choice: number; ms: number } | null {
  if (!s) return null;
  const [c, m] = s.split(':');
  return { choice: Number(c), ms: Number(m) };
}

/** 100 points for a right answer, plus up to 50 for answering fast. */
export function answerPoints(q: TriviaQuestion, a: { choice: number; ms: number } | null, perQuestion: number): number {
  if (!a || a.choice !== q.answer) return 0;
  const left = Math.max(0, perQuestion * 1000 - a.ms) / (perQuestion * 1000);
  return 100 + Math.round(50 * left);
}

export function scoreTrivia(
  questions: TriviaQuestion[],
  perQuestion: number,
  plays: { uid: string; name: string; answers: string[] }[],
) {
  return plays
    .map((p) => {
      let score = 0;
      let correct = 0;
      questions.forEach((q, i) => {
        const pts = answerPoints(q, decodeAnswer(p.answers[i]), perQuestion);
        score += pts;
        if (pts) correct++;
      });
      return { uid: p.uid, name: p.name, score, correct };
    })
    .sort((a, b) => b.score - a.score);
}

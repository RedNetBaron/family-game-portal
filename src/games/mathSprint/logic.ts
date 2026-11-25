// Math Sprint: problem generation and scoring (no Firebase, no React).

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Adding and subtracting to 20, times tables to 10' },
  { id: 'medium', label: 'Medium', blurb: 'Two-digit adding and subtracting, times tables to 12' },
  { id: 'hard', label: 'Hard', blurb: 'Three-digit sums, two-digit times one-digit, bigger division' },
];
export const TIMER_PRESETS = [30, 60, 120];
export const MIN_SECONDS = 30;
export const MAX_SECONDS = 300;
export const MAX_PROBLEMS = 400;

type Op = '+' | '-' | 'x' | '/';
export const SYMBOL: Record<Op, string> = { '+': '+', '-': '−', x: '×', '/': '÷' };

const int = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

function one(level: Level, rand: () => number): string {
  const op = (['+', '-', 'x', '/'] as Op[])[Math.floor(rand() * 4)];
  const r = (lo: number, hi: number) => int(lo, hi, rand);
  if (level === 'easy') {
    if (op === '+') return `${r(1, 10)}+${r(1, 10)}`;
    if (op === '-') { const a = r(2, 20); return `${a}-${r(1, a - 1)}`; }
    if (op === 'x') return `${r(2, 10)}x${r(2, 10)}`;
    const b = r(2, 10); return `${b * r(2, 10)}/${b}`;
  }
  if (level === 'medium') {
    if (op === '+') return `${r(11, 99)}+${r(2, 99)}`;
    if (op === '-') { const a = r(20, 99); return `${a}-${r(2, a - 1)}`; }
    if (op === 'x') return `${r(3, 12)}x${r(3, 12)}`;
    const b = r(3, 12); return `${b * r(3, 12)}/${b}`;
  }
  if (op === '+') return `${r(101, 999)}+${r(11, 999)}`;
  if (op === '-') { const a = r(150, 999); return `${a}-${r(11, a - 1)}`; }
  if (op === 'x') return `${r(13, 49)}x${r(3, 9)}`;
  const b = r(4, 15); return `${b * r(11, 30)}/${b}`;
}

/** Enough problems that nobody runs out: about three a second, plus some spare. */
export function problemCount(seconds: number): number {
  return Math.min(MAX_PROBLEMS, Math.ceil(seconds * 1.5) + 20);
}

export function makeProblems(level: Level, count: number, rand: () => number = Math.random): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const p = one(level, rand);
    if (out[out.length - 1] !== p) out.push(p);
  }
  return out;
}

export function parseProblem(p: string): { a: number; op: Op; b: number } {
  const m = /^(\d+)([-+x/])(\d+)$/.exec(p)!;
  return { a: Number(m[1]), op: m[2] as Op, b: Number(m[3]) };
}

export function answerOf(p: string): number {
  const { a, op, b } = parseProblem(p);
  return op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b;
}

export function showProblem(p: string): string {
  const { a, op, b } = parseProblem(p);
  return `${a} ${SYMBOL[op]} ${b}`;
}

/** Each answer is stored by problem: the number typed, or '-' when skipped. One point per right answer. */
export function scoreSprint(problems: string[], plays: { uid: string; name: string; answers: string[] }[]) {
  return plays
    .map((p) => {
      let right = 0;
      let skipped = 0;
      p.answers.forEach((a, i) => {
        if (a === '-') skipped++;
        else if (problems[i] !== undefined && Number(a) === answerOf(problems[i])) right++;
      });
      return { uid: p.uid, name: p.name, score: right, right, skipped };
    })
    .sort((a, b) => b.score - a.score || a.skipped - b.skipped);
}

// Number Target rules, shared by the website and the server (no Firebase imports).
//
// Everyone gets the same six numbers and a three-digit target. You combine two
// numbers at a time with + − × ÷ (whole numbers only, no negatives, no fractions)
// and each result becomes a new number you can keep using. Your score is the
// closest value you made to the target.

export const BIG = [25, 50, 75, 100];
export const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
export const TARGET_MIN = 101;
export const TARGET_MAX = 999;
/** Daily Target: seconds you get once you start. */
export const DAILY_SECONDS = 120;
/** Extra seconds the server allows for a slow connection. */
export const DAILY_GRACE_SECONDS = 20;

const OPS = ['+', '-', 'x', '/'];

function pick(arr, n, rand) {
  const a = [...arr];
  const out = [];
  for (let i = 0; i < n; i++) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
  return out;
}

/** Applies one operation, or returns null if it isn't allowed (negative, zero, fraction). */
export function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === 'x') return a * b;
  if (op === '-') return a - b > 0 ? a - b : null;
  if (op === '/') return b !== 0 && a % b === 0 ? a / b : null;
  return null;
}

/**
 * Every value that can be made from the numbers, each with one expression that makes it.
 * Works subset by subset, so six numbers take a few milliseconds.
 */
export function reachable(numbers) {
  const n = numbers.length;
  const full = (1 << n) - 1;
  const sets = new Array(full + 1);
  for (let i = 0; i < n; i++) sets[1 << i] = new Map([[numbers[i], String(numbers[i])]]);
  for (let mask = 1; mask <= full; mask++) {
    if (sets[mask]) continue;
    const out = new Map();
    // Each split of mask into two non-empty halves, counted once.
    for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
      const b = mask ^ a;
      if (a < b) continue;
      for (const [x, ex] of sets[a]) {
        for (const [y, ey] of sets[b]) {
          const [hi, eh, lo, el] = x >= y ? [x, ex, y, ey] : [y, ey, x, ex];
          const tries = [
            [hi + lo, `(${eh} + ${el})`],
            [hi * lo, `${eh} × ${el}`],
            [hi - lo, `(${eh} − ${el})`],
            [lo && hi % lo === 0 ? hi / lo : 0, `${eh} ÷ ${wrapRight(el)}`],
          ];
          for (const [v, e] of tries) if (v > 0 && !out.has(v)) out.set(v, e);
        }
      }
    }
    sets[mask] = out;
  }
  const all = new Map();
  // Fewer numbers first, so the shortest way to make a value wins.
  const masks = [...Array(full).keys()].map((i) => i + 1).sort((p, q) => bits(p) - bits(q));
  for (const m of masks) for (const [v, e] of sets[m]) if (!all.has(v)) all.set(v, strip(e));
  return all;
}

function bits(m) {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
}
/** Right side of ÷ needs brackets if it is itself a product or quotient. */
const wrapRight = (e) => (e.includes(' ') && !(e.startsWith('(') && e.endsWith(')') && balanced(e.slice(1, -1))) ? `(${e})` : e);
const strip = (e) => (e.startsWith('(') && e.endsWith(')') && balanced(e.slice(1, -1)) ? e.slice(1, -1) : e);
function balanced(s) {
  let d = 0;
  for (const ch of s) {
    if (ch === '(') d++;
    if (ch === ')' && --d < 0) return false;
  }
  return d === 0;
}

/** The closest value to the target that can be made, with one way to make it. */
export function bestSolution(numbers, target) {
  let best = null;
  for (const [v, e] of reachable(numbers)) {
    const d = Math.abs(v - target);
    if (!best || d < best.distance) best = { value: v, distance: d, expression: e };
    if (d === 0) break;
  }
  return best;
}

/**
 * A new puzzle. big = how many of the large numbers (0–4), or 'mix' for 1 or 2.
 * The target is always reachable exactly.
 */
export function makePuzzle(big = 'mix', rand = Math.random) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const nBig = big === 'mix' ? 1 + Math.floor(rand() * 2) : Math.max(0, Math.min(4, Number(big) || 0));
    const numbers = [...pick(BIG, nBig, rand), ...pick(SMALL, 6 - nBig, rand)].sort((a, b) => b - a);
    const reach = reachable(numbers);
    const options = [...reach.keys()].filter((v) => v >= TARGET_MIN && v <= TARGET_MAX);
    // Skip targets that are one of the starting numbers or trivially close to it.
    const fair = options.filter((v) => !numbers.includes(v));
    if (fair.length < 50) continue;
    return { numbers, target: fair[Math.floor(rand() * fair.length)] };
  }
  return { numbers: [100, 75, 6, 4, 3, 2], target: 452 };
}

/**
 * A step is "a op b" with op one of + - x /, optionally followed by "@ms" (time since the
 * round started). Steps are replayed against the starting numbers to check them.
 */
export function parseStep(s) {
  const m = /^(\d{1,7})([-+x/])(\d{1,7})(?:@(\d{1,7}))?$/.exec(String(s));
  if (!m) return null;
  return { a: Number(m[1]), op: m[2], b: Number(m[3]), ms: m[4] ? Number(m[4]) : 0 };
}

export function stepString(a, op, b, ms) {
  return `${a}${op}${b}@${Math.max(0, Math.round(ms))}`;
}

/**
 * Replays steps. Returns the closest value made (the starting numbers count too),
 * how far it is from the target, when it was first reached, and the steps that were valid.
 * Replay stops at the first invalid step.
 */
export function replay(numbers, target, steps) {
  const pool = [...numbers];
  let best = numbers.reduce((p, v) => (Math.abs(v - target) < Math.abs(p - target) ? v : p), numbers[0]);
  let bestMs = 0;
  const valid = [];
  for (const raw of steps || []) {
    const s = parseStep(raw);
    if (!s || !OPS.includes(s.op)) break;
    const i = pool.indexOf(s.a);
    if (i < 0) break;
    pool.splice(i, 1);
    const j = pool.indexOf(s.b);
    if (j < 0) break;
    pool.splice(j, 1);
    const v = apply(s.a, s.op, s.b);
    if (v === null) break;
    pool.push(v);
    valid.push({ ...s, value: v });
    if (Math.abs(v - target) < Math.abs(best - target)) {
      best = v;
      bestMs = s.ms;
    }
  }
  return { best, distance: Math.abs(best - target), ms: bestMs, steps: valid };
}

/** Points for one round of a Number Target game: exact = 10 plus up to 5 for speed. */
export function roundPoints(distance, ms, seconds) {
  if (distance === 0) return 10 + Math.round(5 * Math.max(0, seconds * 1000 - ms) / (seconds * 1000));
  if (distance <= 5) return 7;
  if (distance <= 10) return 5;
  if (distance <= 25) return 2;
  return 0;
}

/** Daily Target points for the monthly scoreboard: exact = 5, within 5 = 4, 10 = 3, 25 = 2, else 1. */
export function dailyTargetPoints(distance) {
  if (distance === 0) return 5;
  if (distance <= 5) return 4;
  if (distance <= 10) return 3;
  if (distance <= 25) return 2;
  return 1;
}

export const OP_SYMBOL = { '+': '+', '-': '−', x: '×', '/': '÷' };

// Letter Grid: pure game logic (no Firebase, no React).

export const SIZE = 4;
export const ROUND_SECONDS = 180;
export const MIN_WORD = 3;

// Letter weights roughly follow English frequency. "Qu" is one tile.
const WEIGHTS: Record<string, number> = {
  E: 12, A: 9, I: 8, O: 8, T: 8, N: 7, S: 7, R: 7, H: 4, L: 5, D: 4, C: 3, U: 4,
  M: 3, F: 2, P: 2, G: 2, W: 2, Y: 2, B: 2, V: 1, K: 1, X: 0.5, J: 0.4, QU: 0.5, Z: 0.4,
};
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

function pick(rand: () => number): string {
  const entries = Object.entries(WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [letter, w] of entries) {
    r -= w;
    if (r <= 0) return letter;
  }
  return 'E';
}

export function makeGrid(rand: () => number = Math.random): string[] {
  for (;;) {
    const grid = Array.from({ length: SIZE * SIZE }, () => pick(rand));
    const vowels = grid.filter((l) => VOWELS.has(l)).length;
    const rare = grid.filter((l) => 'QU X J Z K V'.split(' ').includes(l)).length;
    if (vowels >= 4 && vowels <= 7 && rare <= 2) return grid;
  }
}

export function neighbors(i: number): number[] {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
    }
  }
  return out;
}

export function isAdjacent(a: number, b: number): boolean {
  return neighbors(a).includes(b);
}

export function pathToWord(grid: string[], path: number[]): string {
  return path.map((i) => grid[i]).join('').toLowerCase();
}

/** Returns a path of tiles spelling the word, or null if it can't be made. */
export function findPath(grid: string[], word: string): number[] | null {
  const w = word.toUpperCase();
  const dfs = (pos: number, at: number, used: number[]): number[] | null => {
    const tile = grid[at];
    if (!w.startsWith(tile, pos)) return null;
    const next = pos + tile.length;
    const path = [...used, at];
    if (next === w.length) return path;
    for (const n of neighbors(at)) {
      if (!path.includes(n)) {
        const found = dfs(next, n, path);
        if (found) return found;
      }
    }
    return null;
  };
  for (let i = 0; i < grid.length; i++) {
    const found = dfs(0, i, []);
    if (found) return found;
  }
  return null;
}

export function wordPoints(word: string): number {
  const n = word.length;
  if (n < MIN_WORD) return 0;
  if (n <= 4) return 1;
  if (n === 5) return 2;
  if (n === 6) return 3;
  if (n === 7) return 5;
  return 11;
}

export type PlayerResult = {
  uid: string;
  name: string;
  score: number;
  words: { word: string; points: number; shared: boolean }[];
};

/** Words found by more than one player score nothing. */
export function scoreRound(plays: { uid: string; name: string; words: string[] }[]): PlayerResult[] {
  const counts = new Map<string, number>();
  for (const p of plays) for (const w of new Set(p.words)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return plays
    .map((p) => {
      const words = [...new Set(p.words)]
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .map((word) => {
          const shared = (counts.get(word) ?? 0) > 1;
          return { word, shared, points: shared ? 0 : wordPoints(word) };
        });
      return { uid: p.uid, name: p.name, words, score: words.reduce((s, w) => s + w.points, 0) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Every dictionary word that can be made on the grid. */
export function solve(grid: string[], dict: Set<string>, prefixes: Set<string>): string[] {
  const found = new Set<string>();
  const dfs = (at: number, sofar: string, used: Set<number>) => {
    const s = sofar + grid[at].toLowerCase();
    if (!prefixes.has(s) && !dict.has(s)) return;
    if (s.length >= MIN_WORD && dict.has(s)) found.add(s);
    used.add(at);
    for (const n of neighbors(at)) if (!used.has(n)) dfs(n, s, used);
    used.delete(at);
  };
  for (let i = 0; i < grid.length; i++) dfs(i, '', new Set());
  return [...found].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

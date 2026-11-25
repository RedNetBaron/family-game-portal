// Number Target: game settings and scoring (no Firebase, no React).
import { replay, roundPoints, type Puzzle } from '../../../functions/shared/numbers.js';

export const ROUND_COUNTS = [1, 3, 5];
export const PER_ROUND_PRESETS = [30, 60, 90];
export const MIN_PER_ROUND = 20;
export const MAX_PER_ROUND = 180;
export const BIG_CHOICES: ('mix' | number)[] = ['mix', 0, 1, 2, 3, 4];
/** Pause after each round to show how you did and one way to solve it. */
export const REVEAL_SECONDS = 5;

export function roundSeconds(rounds: number, perRound: number): number {
  return rounds * (perRound + REVEAL_SECONDS);
}

/** A round is stored as its steps joined with ';' (empty if no steps). */
export function encodeRound(steps: string[]): string {
  return steps.join(';');
}
export function decodeRound(s: string | undefined): string[] {
  return s ? s.split(';').filter(Boolean) : [];
}

export function roundResult(p: Puzzle, entry: string | undefined, perRound: number) {
  const r = replay(p.numbers, p.target, decodeRound(entry));
  return { ...r, points: entry === undefined ? 0 : roundPoints(r.distance, r.ms, perRound) };
}

export function scoreNumberTarget(puzzles: Puzzle[], perRound: number, plays: { uid: string; name: string; rounds: string[] }[]) {
  return plays
    .map((p) => {
      let score = 0;
      let exact = 0;
      puzzles.forEach((pz, i) => {
        const r = roundResult(pz, p.rounds[i], perRound);
        score += r.points;
        if (p.rounds[i] !== undefined && r.distance === 0) exact++;
      });
      return { uid: p.uid, name: p.name, score, exact };
    })
    .sort((a, b) => b.score - a.score);
}

export function bigLabel(big: 'mix' | number): string {
  return big === 'mix' ? 'Mix' : big === 0 ? 'None' : String(big);
}

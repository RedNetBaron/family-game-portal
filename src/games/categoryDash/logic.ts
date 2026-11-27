// Category Dash: pure scoring logic.

export const CATEGORY_COUNTS = [6, 9, 12];
export const TIMER_PRESETS = [60, 120, 180];

/** Lowercase, drop a leading "the/a/an", keep only letters and digits. */
export function normalize(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

export function startsWithLetter(answer: string, letter: string): boolean {
  const n = normalize(answer);
  return n.length > 0 && n[0] === letter.toLowerCase();
}

/** Small connecting words that don't count for or against a multi-word answer. */
const FILLER = new Set(['a', 'an', 'the', 'and', 'n', 'of', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);

/**
 * Points for an accepted answer: 1 point for each main word when every main word starts with the letter
 * ("Bugs Bunny" = 2, "Bed Bath and Beyond" = 3 for B). Small words like "and" or "of" are skipped.
 * If any main word starts with another letter ("Bob Dylan"), the answer scores 1.
 */
export function answerPoints(answer: string, letter: string): number {
  const words = answer
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w && !FILLER.has(w));
  const l = letter.toLowerCase();
  return words.length >= 2 && words.every((w) => w[0] === l) ? words.length : 1;
}

export type AnswerStatus = 'ok' | 'blank' | 'wrong-letter' | 'duplicate' | 'rejected';

export type ScoredAnswer = {
  uid: string;
  name: string;
  answer: string;
  status: AnswerStatus;
  points: number;
  rejectVotes: number;
};

export type PlayAnswers = { uid: string; name: string; answers: string[] };

/** votes: voter uid -> set of "categoryIndex|authorUid" keys they reject. */
export function scoreGame(
  letter: string,
  categoryCount: number,
  plays: PlayAnswers[],
  votes: Record<string, Record<string, boolean>>,
) {
  const voters = plays.map((p) => p.uid);
  const byCategory: ScoredAnswer[][] = [];
  const totals = new Map<string, number>(plays.map((p) => [p.uid, 0]));

  for (let c = 0; c < categoryCount; c++) {
    const entries = plays.map((p) => ({ p, raw: (p.answers[c] ?? '').trim() }));
    const counts = new Map<string, number>();
    for (const { raw } of entries) {
      const n = normalize(raw);
      if (n && startsWithLetter(raw, letter)) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    byCategory.push(
      entries.map(({ p, raw }) => {
        const key = `${c}|${p.uid}`;
        const rejectVotes = voters.filter((v) => v !== p.uid && votes[v]?.[key]).length;
        const others = voters.length - 1;
        let status: AnswerStatus = 'ok';
        if (!normalize(raw)) status = 'blank';
        else if (!startsWithLetter(raw, letter)) status = 'wrong-letter';
        else if (others > 0 && rejectVotes * 2 > others) status = 'rejected';
        else if ((counts.get(normalize(raw)) ?? 0) > 1) status = 'duplicate';
        const points = status === 'ok' ? answerPoints(raw, letter) : 0;
        totals.set(p.uid, (totals.get(p.uid) ?? 0) + points);
        return { uid: p.uid, name: p.name, answer: raw, status, points, rejectVotes };
      }),
    );
  }

  const standings = plays
    .map((p) => ({ uid: p.uid, name: p.name, score: totals.get(p.uid) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  return { byCategory, standings };
}

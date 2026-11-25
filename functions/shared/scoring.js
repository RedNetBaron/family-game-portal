// Scoring shared by the website and the server (Cloud Functions).
// Plain JS with a .d.ts next to it so both sides use the same rules.

export const TIME_ZONE = 'America/Chicago';

/** Placement points: 1st, 2nd, 3rd. Everyone else who played gets PLAY_POINTS. */
export const PLACE_POINTS = [5, 3, 2];
export const PLAY_POINTS = 1;
/** Only a person's best this-many game results per day count toward the month. */
export const DAILY_GAME_CAP = 3;

export const GAME_LABELS = {
  letterGrid: 'Letter Grid',
  categoryDash: 'Category Dash',
  trivia: 'Family Trivia',
  dailyWord: 'Daily Word',
  numberTarget: 'Number Target',
  mathSprint: 'Math Sprint',
  dailyTarget: 'Daily Target',
};

/** Daily puzzles (scored by the server into dailyScores). Docs without a game field are Daily Word. */
export const DAILY_GAMES = ['dailyWord', 'dailyTarget'];
export const dailyGameOf = (d) => d.game || 'dailyWord';

/** 'YYYY-MM-DD' in the family's time zone. */
export function familyDay(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function familyMonth(ms) {
  return familyDay(ms).slice(0, 7);
}

/** The day before a 'YYYY-MM-DD' day. */
export function previousDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The month before a 'YYYY-MM' month. */
export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

/**
 * Placement points for one finished game. rows: [{ uid, name, score }].
 * Ties share the better place. A game with one player only earns the play point.
 */
export function placements(rows) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const out = {};
  sorted.forEach((r, i) => {
    const place = i > 0 && sorted[i - 1].score === r.score ? out[sorted[i - 1].uid].place : i + 1;
    const points = sorted.length < 2 ? PLAY_POINTS : (PLACE_POINTS[place - 1] ?? PLAY_POINTS);
    out[r.uid] = { name: r.name, score: r.score, place, points };
  });
  return out;
}

/** Daily Word points: solved in 1–2 = 5, 3 = 4, 4 = 3, 5–6 = 2, not solved = 1 for playing. */
export function dailyWordPoints(solved, guesses) {
  if (!solved) return PLAY_POINTS;
  return [5, 5, 4, 3, 2, 2][guesses - 1] ?? 2;
}

/**
 * Month standings.
 * results: [{ type, day, placements: { uid: { name, place, points } } }]
 * daily:   [{ uid, name, day, points, solved }]
 * board:   'overall' or a game type ('letterGrid', 'dailyWord', 'dailyTarget', ...).
 */
export function standings(results, daily, board = 'overall') {
  const people = new Map();
  const person = (uid, name) => {
    if (!people.has(uid)) people.set(uid, { uid, name, points: 0, games: 0, wins: 0 });
    const p = people.get(uid);
    if (name) p.name = name;
    return p;
  };

  const dailyBoard = DAILY_GAMES.includes(board);
  if (!dailyBoard) {
    // Group each person's game results by day and keep the best few.
    const perDay = new Map();
    for (const r of results) {
      if (board !== 'overall' && r.type !== board) continue;
      for (const [uid, pl] of Object.entries(r.placements || {})) {
        const key = `${uid}|${r.day}`;
        if (!perDay.has(key)) perDay.set(key, []);
        perDay.get(key).push({ uid, ...pl });
      }
    }
    for (const list of perDay.values()) {
      list.sort((a, b) => b.points - a.points);
      list.forEach((pl, i) => {
        const p = person(pl.uid, pl.name);
        p.games += 1;
        if (pl.place === 1 && pl.points > PLAY_POINTS) p.wins += 1;
        if (i < DAILY_GAME_CAP) p.points += pl.points;
      });
    }
  }

  if (board === 'overall' || dailyBoard) {
    for (const d of daily) {
      if (dailyBoard && dailyGameOf(d) !== board) continue;
      const p = person(d.uid, d.name);
      p.points += d.points;
      p.games += 1;
      if (d.solved && dailyBoard) p.wins += 1;
    }
  }

  const rows = [...people.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  rows.forEach((r, i) => {
    r.place = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].place : i + 1;
  });
  return rows;
}

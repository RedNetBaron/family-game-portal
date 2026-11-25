import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  DAILY_GAME_CAP,
  familyDay,
  familyMonth,
  GAME_LABELS,
  monthName,
  PLACE_POINTS,
  PLAY_POINTS,
  previousDay,
  previousMonth,
  standings,
  type DailyScore,
  type GameResult,
} from '../../functions/shared/scoring.js';
import { db } from '../lib/firebase';
import type { Member } from '../lib/useMember';
import { useNow } from '../lib/useNow';

type Champion = { month: string; uid: string; name: string; points: number };

const BOARDS = [
  { id: 'overall', label: 'Overall' },
  { id: 'dailyWord', label: GAME_LABELS.dailyWord },
  { id: 'letterGrid', label: GAME_LABELS.letterGrid },
  { id: 'categoryDash', label: GAME_LABELS.categoryDash },
  { id: 'trivia', label: GAME_LABELS.trivia },
];

function useMonthData(month: string) {
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [daily, setDaily] = useState<DailyScore[] | null>(null);
  useEffect(() => {
    setResults(null);
    setDaily(null);
    const a = onSnapshot(query(collection(db, 'results'), where('month', '==', month)), (s) => setResults(s.docs.map((d) => d.data() as GameResult)), () => setResults([]));
    const b = onSnapshot(query(collection(db, 'dailyScores'), where('month', '==', month)), (s) => setDaily(s.docs.map((d) => d.data() as DailyScore)), () => setDaily([]));
    return () => {
      a();
      b();
    };
  }, [month]);
  return { results, daily };
}

export function useChampions() {
  const [list, setList] = useState<Champion[]>([]);
  useEffect(
    () => onSnapshot(query(collection(db, 'champions'), orderBy('month', 'desc')), (s) => setList(s.docs.map((d) => d.data() as Champion)), () => undefined),
    [],
  );
  return list;
}

export function Scores({ member }: { member: Member }) {
  const now = useNow(60_000);
  const thisMonth = familyMonth(now);
  const [month, setMonth] = useState(thisMonth);
  const [board, setBoard] = useState('overall');
  const { results, daily } = useMonthData(month);
  const champions = useChampions();
  const lastChamp = champions.find((c) => c.month === previousMonth(thisMonth));

  const rows = results && daily ? standings(results, daily, board) : null;
  const today = familyDay(now);
  const streaks = (daily ?? [])
    .filter((d) => (d.day === today || d.day === previousDay(today)) && (d.streak ?? 0) > 1)
    .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
    .filter((d, i, all) => all.findIndex((x) => x.uid === d.uid) === i);
  const daysLeft = month === thisMonth ? daysLeftIn(today) : 0;

  return (
    <section className="scores">
      <h2 className="menu-title">Scoreboard</h2>
      <div className="chips">
        <button className={month === thisMonth ? 'chip on' : 'chip'} onClick={() => setMonth(thisMonth)}>
          {monthName(thisMonth)}
        </button>
        <button className={month === previousMonth(thisMonth) ? 'chip on' : 'chip'} onClick={() => setMonth(previousMonth(thisMonth))}>
          {monthName(previousMonth(thisMonth))}
        </button>
      </div>

      <div className="card">
        <div className="chips small">
          {BOARDS.map((b) => (
            <button key={b.id} className={board === b.id ? 'chip on' : 'chip'} onClick={() => setBoard(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {month === thisMonth
            ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in ${monthName(month)}. The champion is crowned on the 1st.`
            : `Final standings for ${monthName(month)}.`}
        </p>
        {!rows ? (
          <p className="center">Loading…</p>
        ) : !rows.length ? (
          <p className="hint">No points yet. Play a game to get on the board!</p>
        ) : (
          <ol className="lg-standings">
            {rows.map((r) => (
              <li key={r.uid} className={r.uid === member.uid ? 'me' : ''}>
                <span className="place">{r.place === 1 && r.points > 0 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : `${r.place}.`}</span>
                <span className="who">
                  {r.name}
                  {lastChamp?.uid === r.uid ? ' 🏆' : ''}{' '}
                  <small className="hint">
                    {r.games} {board === 'dailyWord' ? (r.games === 1 ? 'day' : 'days') : r.games === 1 ? 'game' : 'games'}
                    {r.wins ? ` · ${r.wins} ${board === 'dailyWord' ? 'solved' : r.wins === 1 ? 'win' : 'wins'}` : ''}
                  </small>
                </span>
                <span className="pts">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {streaks.length > 0 && (
        <div className="card">
          <h3>🔥 Daily Word streaks</h3>
          <ul className="plain-list">
            {streaks.map((s) => (
              <li key={s.uid}>
                {s.name}: {s.streak} days in a row
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>🏆 Hall of Fame</h3>
        {!champions.length ? (
          <p className="hint">The first champion will be crowned on the 1st of next month.</p>
        ) : (
          <ul className="plain-list">
            {champions.map((c) => (
              <li key={c.month}>
                <strong>{monthName(c.month)} {c.month.slice(0, 4)}:</strong> {c.name} ({c.points} pts)
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="card">
        <summary>How points work</summary>
        <ul className="plain-list hint">
          <li>
            Each finished game: 1st = {PLACE_POINTS[0]}, 2nd = {PLACE_POINTS[1]}, 3rd = {PLACE_POINTS[2]}, everyone else who played = {PLAY_POINTS}. Ties share the higher place.
          </li>
          <li>A game with only one player earns {PLAY_POINTS} point for playing.</li>
          <li>Only your best {DAILY_GAME_CAP} games each day count, so more games don't automatically win.</li>
          <li>Daily Word: solved in 1–2 guesses = 5, 3 = 4, 4 = 3, 5–6 = 2, not solved = 1.</li>
          <li>Points reset each month. The top player is crowned champion on the 1st.</li>
        </ul>
      </details>
    </section>
  );
}

function daysLeftIn(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return last - d + 1;
}

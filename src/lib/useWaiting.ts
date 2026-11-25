import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { familyDay } from '../../functions/shared/scoring.js';
import { useEffect, useState } from 'react';
import type { BaseGame } from '../games/common/api';
import { db } from './firebase';
import { useNow } from './useNow';

export const GAME_NAMES: Record<string, string> = {
  letterGrid: 'Letter Grid',
  categoryDash: 'Category Dash',
  trivia: 'Family Trivia',
  dailyWord: 'Daily Word',
  numberTarget: 'Number Target',
  mathSprint: 'Math Sprint',
  dailyTarget: 'Daily Target',
};

/** A live lobby older than this is treated as abandoned. */
const LOBBY_MINUTES = 30;

export type Waiting = { game: BaseGame; kind: 'turn' | 'lobby' | 'daily'; hoursLeft: number };

const ms = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : null);

/** Games that are waiting on this member: take-turns games they haven't played and live lobbies they haven't joined. */
export function waitingFor(games: BaseGame[], uid: string, now: number): Waiting[] {
  const out: Waiting[] = [];
  for (const g of games) {
    if (g.players?.[uid]) continue;
    const ends = ms(g.endsAt);
    if (g.mode === 'turns' && ends && now < ends) {
      out.push({ game: g, kind: 'turn', hoursLeft: Math.max(1, Math.round((ends - now) / 3600_000)) });
    } else if (g.mode === 'live' && g.status === 'lobby') {
      const created = ms(g.createdAt) ?? now;
      if (now - created < LOBBY_MINUTES * 60_000) out.push({ game: g, kind: 'lobby', hoursLeft: 0 });
    }
  }
  // Live lobbies first, then the turns that run out soonest.
  return out.sort((a, b) => (a.kind === b.kind ? a.hoursLeft - b.hoursLeft : a.kind === 'lobby' ? -1 : 1));
}

export function useWaiting(uid: string): Waiting[] {
  const [games, setGames] = useState<BaseGame[]>([]);
  const now = useNow(30_000);
  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(
      q,
      (snap) => setGames(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as BaseGame)),
      () => undefined,
    );
  }, []);
  const day = familyDay(now);
  const [dailyDone, setDailyDone] = useState<boolean | null>(null);
  useEffect(() => {
    setDailyDone(null);
    return onSnapshot(doc(db, 'dailyScores', `${day}_${uid}`), (s) => setDailyDone(s.exists()), () => setDailyDone(null));
  }, [day, uid]);
  const [targetDone, setTargetDone] = useState<boolean | null>(null);
  useEffect(() => {
    setTargetDone(null);
    return onSnapshot(doc(db, 'dailyScores', `dt_${day}_${uid}`), (s) => setTargetDone(s.exists()), () => setTargetDone(null));
  }, [day, uid]);
  const waiting = waitingFor(games, uid, now);
  if (dailyDone === false) {
    waiting.push({
      game: { id: `daily-${day}`, type: 'dailyWord', createdByName: 'today', mode: 'turns' } as BaseGame,
      kind: 'daily',
      hoursLeft: 0,
    });
  }
  if (targetDone === false) {
    waiting.push({
      game: { id: `daily-target-${day}`, type: 'dailyTarget', createdByName: 'today', mode: 'turns' } as BaseGame,
      kind: 'daily',
      hoursLeft: 0,
    });
  }

  // Show the count on the browser tab and, when installed to the home screen, on the app icon.
  const count = waiting.length;
  useEffect(() => {
    document.title = count ? `(${count}) Family Games` : 'Family Games';
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count) nav.setAppBadge?.(count).catch(() => undefined);
    else nav.clearAppBadge?.().catch(() => undefined);
  }, [count]);

  return waiting;
}

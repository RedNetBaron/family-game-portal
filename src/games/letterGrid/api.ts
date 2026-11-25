import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { formatDuration, makeGrid } from './logic';

export type Mode = 'live' | 'turns';

export type Game = {
  id: string;
  type: 'letterGrid';
  mode: Mode;
  size: number;
  grid: string[];
  seconds: number;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  /** live: 'lobby' until the host starts. turns: always 'open'. */
  status: 'lobby' | 'started' | 'done' | 'open';
  startAt: Timestamp | null;
  /** live: end of the round. turns: deadline to play. */
  endsAt: Timestamp | null;
  /** Everyone who joined (live) or started playing (turns). */
  players: Record<string, string>;
};

export type Play = {
  uid: string;
  name: string;
  words: string[];
  startedAt: Timestamp | null;
  submittedAt: Timestamp | null;
};

export const TURNS_HOURS = 24;

export type GameOptions = { size: number; seconds: number };

export async function createGame(member: Member, mode: Mode, opts: GameOptions): Promise<string> {
  const ref = await addDoc(collection(db, 'games'), {
    type: 'letterGrid',
    mode,
    size: opts.size,
    grid: makeGrid(opts.size),
    seconds: opts.seconds,
    createdBy: member.uid,
    createdByName: member.name,
    createdAt: serverTimestamp(),
    status: mode === 'live' ? 'lobby' : 'open',
    startAt: null,
    endsAt: mode === 'turns' ? Timestamp.fromMillis(Date.now() + TURNS_HOURS * 3600_000) : null,
    players: mode === 'live' ? { [member.uid]: member.name } : {},
  });
  await addDoc(collection(db, 'messages'), {
    uid: member.uid,
    name: member.name,
    text:
      mode === 'live'
        ? `started a live Letter Grid game (${opts.size}×${opts.size}, ${formatDuration(opts.seconds)}). Join now!`
        : `started a Letter Grid game (${opts.size}×${opts.size}, ${formatDuration(opts.seconds)}). Play your turn in the next ${TURNS_HOURS} hours.`,
    gameId: ref.id,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
  return ref.id;
}

export function joinLobby(gameId: string, member: Member) {
  return updateDoc(doc(db, 'games', gameId), { [`players.${member.uid}`]: member.name });
}

export function startLiveGame(game: Game) {
  // A short countdown so everyone's screen starts together.
  const start = Date.now() + 6000;
  return updateDoc(doc(db, 'games', game.id), {
    status: 'started',
    startAt: Timestamp.fromMillis(start),
    endsAt: Timestamp.fromMillis(start + game.seconds * 1000),
  });
}

/** Creates the player's play record when their round begins (once). */
export async function beginPlay(game: Game, member: Member): Promise<void> {
  const ref = doc(db, 'games', game.id, 'plays', member.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, {
    uid: member.uid,
    name: member.name,
    words: [],
    startedAt: serverTimestamp(),
    submittedAt: null,
  });
  if (game.mode === 'turns') {
    await updateDoc(doc(db, 'games', game.id), { [`players.${member.uid}`]: member.name });
  }
}

export function saveWords(gameId: string, uid: string, words: string[]) {
  return updateDoc(doc(db, 'games', gameId, 'plays', uid), { words });
}

export function submitPlay(gameId: string, uid: string, words: string[]) {
  return updateDoc(doc(db, 'games', gameId, 'plays', uid), {
    words,
    submittedAt: serverTimestamp(),
  });
}

const markedDone = new Set<string>();
export function markDone(gameId: string) {
  if (markedDone.has(gameId)) return;
  markedDone.add(gameId);
  updateDoc(doc(db, 'games', gameId), { status: 'done' }).catch(() => markedDone.delete(gameId));
}

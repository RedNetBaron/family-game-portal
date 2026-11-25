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

export type Mode = 'live' | 'turns';

/** Fields every game shares. Each game type adds its own. */
export type BaseGame = {
  id: string;
  type: string;
  mode: Mode;
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
  /** Letter Grid: words found. Category Dash: one answer per category. */
  words: string[];
  startedAt: Timestamp | null;
  submittedAt: Timestamp | null;
};

export const TURNS_HOURS = 24;

/** Shared fields for a new game document. */
export function newGameFields(member: Member, mode: Mode, seconds: number) {
  return {
    mode,
    seconds,
    createdBy: member.uid,
    createdByName: member.name,
    createdAt: serverTimestamp(),
    status: mode === 'live' ? 'lobby' : 'open',
    startAt: null,
    endsAt: mode === 'turns' ? Timestamp.fromMillis(Date.now() + TURNS_HOURS * 3600_000) : null,
    players: mode === 'live' ? { [member.uid]: member.name } : {},
  };
}

/** Announces a new game in the family chat with an Open game button. */
export function postGameMessage(member: Member, gameId: string, text: string) {
  return addDoc(collection(db, 'messages'), {
    uid: member.uid,
    name: member.name,
    text,
    gameId,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
}

/** Take-turns games: the creator can close the game early so results are final. */
export function closeNow(gameId: string) {
  return updateDoc(doc(db, 'games', gameId), { endsAt: Timestamp.fromMillis(Date.now()) });
}

export function joinLobby(gameId: string, member: Member) {
  return updateDoc(doc(db, 'games', gameId), { [`players.${member.uid}`]: member.name });
}

export function startLiveGame(game: BaseGame) {
  // A short countdown so everyone's screen starts together.
  const start = Date.now() + 6000;
  return updateDoc(doc(db, 'games', game.id), {
    status: 'started',
    startAt: Timestamp.fromMillis(start),
    endsAt: Timestamp.fromMillis(start + game.seconds * 1000),
  });
}

/** Creates the player's play record when their round begins (once). */
export async function beginPlay(game: BaseGame, member: Member): Promise<void> {
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

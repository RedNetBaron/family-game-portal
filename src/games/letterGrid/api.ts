import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { newGameFields, postGameMessage, TURNS_HOURS, type BaseGame, type Mode } from '../common/api';
import { formatDuration, makeGrid } from './logic';

export * from '../common/api';

export type Game = BaseGame & { type: 'letterGrid'; size: number; grid: string[] };

export type GameOptions = { size: number; seconds: number };

export async function createGame(member: Member, mode: Mode, opts: GameOptions): Promise<string> {
  const ref = await addDoc(collection(db, 'games'), {
    ...newGameFields(member, mode, opts.seconds),
    type: 'letterGrid',
    size: opts.size,
    grid: makeGrid(opts.size),
  });
  const what = `Letter Grid game (${opts.size}×${opts.size}, ${formatDuration(opts.seconds)})`;
  await postGameMessage(
    member,
    ref.id,
    mode === 'live' ? `started a live ${what}. Join now!` : `started a ${what}. Play your turn in the next ${TURNS_HOURS} hours.`,
  );
  return ref.id;
}

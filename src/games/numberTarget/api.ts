import { addDoc, collection } from 'firebase/firestore';
import { makePuzzle, type Puzzle } from '../../../functions/shared/numbers.js';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { newGameFields, postGameMessage, TURNS_HOURS, type BaseGame, type Mode } from '../common/api';
import { roundSeconds } from './logic';

export type NumberTargetGame = BaseGame & {
  type: 'numberTarget';
  perRound: number;
  big: 'mix' | number;
  puzzles: Puzzle[];
};

export async function createNumberTargetGame(
  member: Member,
  mode: Mode,
  opts: { rounds: number; perRound: number; big: 'mix' | number },
): Promise<string> {
  const puzzles = Array.from({ length: opts.rounds }, () => makePuzzle(opts.big));
  const ref = await addDoc(collection(db, 'games'), {
    ...newGameFields(member, mode, roundSeconds(puzzles.length, opts.perRound)),
    type: 'numberTarget',
    perRound: opts.perRound,
    big: opts.big,
    puzzles,
  });
  const what = `Number Target game (${puzzles.length} ${puzzles.length === 1 ? 'round' : 'rounds'}, ${opts.perRound}s each)`;
  await postGameMessage(
    member,
    ref.id,
    mode === 'live' ? `started a live ${what}. Join now!` : `started a ${what}. Play your turn in the next ${TURNS_HOURS} hours.`,
  );
  return ref.id;
}

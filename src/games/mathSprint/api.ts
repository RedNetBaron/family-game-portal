import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { newGameFields, postGameMessage, TURNS_HOURS, type BaseGame, type Mode } from '../common/api';
import { LEVELS, makeProblems, problemCount, type Level } from './logic';

export type MathSprintGame = BaseGame & {
  type: 'mathSprint';
  level: Level;
  problems: string[];
};

export async function createMathSprintGame(member: Member, mode: Mode, opts: { level: Level; seconds: number }): Promise<string> {
  const ref = await addDoc(collection(db, 'games'), {
    ...newGameFields(member, mode, opts.seconds),
    type: 'mathSprint',
    level: opts.level,
    problems: makeProblems(opts.level, problemCount(opts.seconds)),
  });
  const label = LEVELS.find((l) => l.id === opts.level)!.label;
  const what = `Math Sprint (${label}, ${opts.seconds}s)`;
  await postGameMessage(
    member,
    ref.id,
    mode === 'live' ? `started a live ${what}. Join now!` : `started a ${what}. Play your turn in the next ${TURNS_HOURS} hours.`,
  );
  return ref.id;
}

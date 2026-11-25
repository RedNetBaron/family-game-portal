import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { newGameFields, postGameMessage, TURNS_HOURS, type BaseGame, type Mode } from '../common/api';
import { pickQuestions, roundSeconds, type TriviaQuestion } from './logic';
import type { Category } from './questions';

export type TriviaGame = BaseGame & {
  type: 'trivia';
  perQuestion: number;
  categories: Category[];
  questions: TriviaQuestion[];
};

export async function createTriviaGame(
  member: Member,
  mode: Mode,
  opts: { categories: Category[]; count: number; perQuestion: number },
): Promise<string> {
  const questions = pickQuestions(opts.categories, opts.count);
  const ref = await addDoc(collection(db, 'games'), {
    ...newGameFields(member, mode, roundSeconds(questions.length, opts.perQuestion)),
    type: 'trivia',
    perQuestion: opts.perQuestion,
    categories: opts.categories,
    questions,
  });
  const what = `Family Trivia game (${questions.length} questions, ${opts.perQuestion}s each)`;
  await postGameMessage(
    member,
    ref.id,
    mode === 'live' ? `started a live ${what}. Join now!` : `started a ${what}. Play your turn in the next ${TURNS_HOURS} hours.`,
  );
  return ref.id;
}

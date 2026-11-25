import { addDoc, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import type { Member } from '../../lib/useMember';
import { newGameFields, postGameMessage, TURNS_HOURS, type BaseGame, type Mode } from '../common/api';
import { formatDuration } from '../letterGrid/logic';
import { pickCategories, pickLetter } from './categories';

export type CategoryGame = BaseGame & { type: 'categoryDash'; letter: string; categories: string[] };

export async function createCategoryGame(
  member: Member,
  mode: Mode,
  opts: { count: number; seconds: number },
): Promise<string> {
  const ref = await addDoc(collection(db, 'games'), {
    ...newGameFields(member, mode, opts.seconds),
    type: 'categoryDash',
    letter: pickLetter(),
    categories: pickCategories(opts.count),
  });
  const what = `Category Dash game (${opts.count} categories, ${formatDuration(opts.seconds)})`;
  await postGameMessage(
    member,
    ref.id,
    mode === 'live' ? `started a live ${what}. Join now!` : `started a ${what}. Play your turn in the next ${TURNS_HOURS} hours.`,
  );
  return ref.id;
}

/** votes: voter uid -> { "categoryIndex|authorUid": true } for answers they reject. */
export type Votes = Record<string, Record<string, boolean>>;

export function useVotes(gameId: string, enabled: boolean): Votes {
  const [votes, setVotes] = useState<Votes>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      collection(db, 'games', gameId, 'votes'),
      (snap) => {
        const v: Votes = {};
        snap.docs.forEach((d) => (v[d.id] = (d.data().rejects ?? {}) as Record<string, boolean>));
        setVotes(v);
      },
      () => {
        if (attempt < 8) retry = setTimeout(() => setAttempt((a) => a + 1), 1000);
      },
    );
    return () => {
      stop();
      clearTimeout(retry);
    };
  }, [gameId, enabled, attempt]);
  return votes;
}

export function saveMyVotes(gameId: string, uid: string, rejects: Record<string, boolean>) {
  return setDoc(doc(db, 'games', gameId, 'votes', uid), { rejects });
}

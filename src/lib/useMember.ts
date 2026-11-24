import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from './firebase';

export type Member = { uid: string; name: string };

export type MemberState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'not-member'; user: User }
  | { status: 'member'; member: Member };

export function useMember(): MemberState {
  const [state, setState] = useState<MemberState>({ status: 'loading' });

  useEffect(() => {
    let stopDoc: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopDoc?.();
      stopDoc = undefined;
      if (!user) {
        setState({ status: 'signed-out' });
        return;
      }
      setState({ status: 'loading' });
      stopDoc = onSnapshot(
        doc(db, 'members', user.uid),
        (snap) => {
          // Wait for the server to confirm a just-written member record,
          // so a rejected join never flashes the signed-in screen.
          if (snap.metadata.hasPendingWrites) return;
          if (snap.exists()) {
            setState({ status: 'member', member: { uid: user.uid, name: snap.data().name } });
          } else {
            setState({ status: 'not-member', user });
          }
        },
        () => setState({ status: 'not-member', user }),
      );
    });
    return () => {
      stopDoc?.();
      stopAuth();
    };
  }, []);

  return state;
}

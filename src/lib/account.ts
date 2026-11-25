import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { disableNotifications } from './notify';

// Family members sign in with a name and password. Firebase needs an email,
// so each name maps to a private address that never receives mail.
export function nameToLogin(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loginEmail(name: string): string {
  return `${nameToLogin(name)}@members.family-games.invalid`;
}

export function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Someone already joined with that name. Try a different one, or sign in.';
    case 'auth/weak-password':
      return 'Please use a password of at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That name and password don't match.";
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a minute and try again.';
    case 'permission-denied':
      return "That invite link isn't valid. Ask for a new one.";
    default:
      return 'Something went wrong. Please try again.';
  }
}

// True while a join is in progress, so the app keeps the join form on screen
// during the brief moment the new account exists but isn't a member yet.
export let joinInProgress = false;

export async function joinFamily(name: string, password: string, invite: string) {
  joinInProgress = true;
  try {
    await createMember(name, password, invite);
  } finally {
    joinInProgress = false;
  }
}

async function createMember(name: string, password: string, invite: string) {
  const display = name.trim();
  if (!nameToLogin(display)) throw Object.assign(new Error(), { code: 'bad-name' });
  const cred = await createUserWithEmailAndPassword(auth, loginEmail(display), password);
  try {
    await setDoc(doc(db, 'members', cred.user.uid), {
      name: display,
      invite,
      joinedAt: serverTimestamp(),
    });
  } catch (err) {
    // Bad invite: remove the half-created account so the name is free again.
    await deleteUser(cred.user).catch(() => signOut(auth));
    throw err;
  }
}

export function signInMember(name: string, password: string) {
  return signInWithEmailAndPassword(auth, loginEmail(name), password);
}

export async function signOutMember() {
  // Stop this phone getting the old member's notifications.
  await disableNotifications().catch(() => undefined);
  return signOut(auth);
}

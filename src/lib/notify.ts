import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, db } from './firebase';

/** Public key from Firebase console > Project settings > Cloud Messaging > Web Push certificates. */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SAVED = 'fg-push-token';

export type NotifyState =
  | 'loading'
  | 'unavailable' // not set up yet, or this browser can't do push
  | 'ios-install' // iPhone/iPad: must be added to the Home Screen first
  | 'blocked' // the person said no in the browser prompt
  | 'off'
  | 'on';

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function saved() {
  try {
    return localStorage.getItem(SAVED);
  } catch {
    return null;
  }
}

export async function notifyState(): Promise<NotifyState> {
  if (!VAPID_KEY) return 'unavailable';
  if (isIos() && !isStandalone()) return 'ios-install';
  if ( !('serviceWorker' in navigator) || !('Notification' in window)) return 'unavailable';
  if (!(await isSupported().catch(() => false))) return 'unavailable';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && saved() ? 'on' : 'off';
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

/** Asks for permission, gets this device's push token and saves it for the family's sender. */
export async function enableNotifications(uid: string): Promise<NotifyState> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() });
  await setDoc(doc(db, 'pushTokens', token), { uid, createdAt: serverTimestamp() });
  try {
    localStorage.setItem(SAVED, token);
  } catch {
    /* fine: state just shows "off" next time */
  }
  return 'on';
}

export async function disableNotifications(): Promise<NotifyState> {
  const token = saved();
  if (token) await deleteDoc(doc(db, 'pushTokens', token)).catch(() => undefined);
  await deleteToken(getMessaging(app)).catch(() => undefined);
  try {
    localStorage.removeItem(SAVED);
  } catch {
    /* ignore */
  }
  return 'off';
}

/** Keeps the saved token fresh (tokens can rotate). Call once after sign-in. */
export async function refreshToken(uid: string) {
  if ((await notifyState()) !== 'on') return;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() }).catch(() => null);
  if (!token) return;
  const old = saved();
  if (old && old !== token) await deleteDoc(doc(db, 'pushTokens', old)).catch(() => undefined);
  await setDoc(doc(db, 'pushTokens', token), { uid, createdAt: serverTimestamp() }).catch(() => undefined);
  try {
    localStorage.setItem(SAVED, token);
  } catch {
    /* ignore */
  }
}

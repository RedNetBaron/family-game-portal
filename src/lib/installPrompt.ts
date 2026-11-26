import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let saved: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  saved = e as InstallEvent;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  saved = null;
  listeners.forEach((l) => l());
});

/** The browser's saved install prompt (Chrome on Android, desktop), or null when it isn't offering one. */
export function useInstallPrompt(): [boolean, () => Promise<void>] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const install = async () => {
    const e = saved;
    if (!e) return;
    await e.prompt();
    await e.userChoice.catch(() => undefined);
    saved = null;
    listeners.forEach((l) => l());
  };
  return [saved !== null, install];
}

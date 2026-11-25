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

/** "Install app" button, shown only when the browser offers installing (Chrome on Android, desktop). */
export function InstallButton() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!saved) return null;
  return (
    <div className="card notify">
      <h3>📲 Install Family Games</h3>
      <p className="hint">Adds an icon to your phone so it opens like an app.</p>
      <button
        className="primary"
        onClick={async () => {
          const e = saved;
          if (!e) return;
          await e.prompt();
          await e.userChoice.catch(() => undefined);
          saved = null;
          setTick((t) => t + 1);
        }}
      >
        Install app
      </button>
    </div>
  );
}

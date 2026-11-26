import { useEffect, useState } from 'react';
import {
  disableNotifications,
  enableNotifications,
  isIos,
  isStandalone,
  notifyState,
  refreshToken,
  type NotifyState,
} from '../lib/notify';
import { useMenuView } from '../lib/useMenuView';
import { useInstallPrompt } from '../lib/installPrompt';

const OPEN_EVENT = 'opensettings';

/** Opens the Settings sheet from anywhere in the app. */
export function openSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Settings gear for the header, plus the sheet it opens. */
export function SettingsButton({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Settings">
        <img src="/icons/settings.png" alt="" width="36" height="36" />
      </button>
      {open && <SettingsSheet uid={uid} onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [view, setView] = useMenuView();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet card settings" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close link" onClick={onClose} aria-label="Close">✕</button>
        <h3 className="with-icon">
          <img src="/icons/settings.png" alt="" width="40" height="40" />
          Settings
        </h3>

        <section className="set-row">
          <h4>Games menu</h4>
          <div className="seg" role="radiogroup" aria-label="Games menu">
            {(['list', 'grid'] as const).map((v) => (
              <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {v === 'list' ? '☰ List' : '▦ Grid'}
              </button>
            ))}
          </div>
        </section>

        <NotifySetting uid={uid} />
        <InstallSetting />
      </div>
    </div>
  );
}

function NotifySetting({ uid }: { uid: string }) {
  const [state, setState] = useState<NotifyState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    notifyState().then((s) => {
      setState(s);
      if (s === 'on') refreshToken(uid);
    });
  }, [uid]);

  async function run(fn: () => Promise<NotifyState>) {
    setBusy(true);
    setError('');
    try {
      setState(await fn());
    } catch {
      setError("Couldn't change notifications. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="set-row">
      <h4>🔔 Notifications</h4>
      {state === 'loading' ? (
        <p className="hint">Checking…</p>
      ) : state === 'unavailable' ? (
        <p className="hint">This browser can't show notifications.</p>
      ) : state === 'ios-install' ? (
        <p className="hint">
          On iPhone, install the app first (see below), then open it from the new icon to turn these on.
        </p>
      ) : state === 'blocked' ? (
        <p className="hint">Notifications are blocked. Turn them on in your phone's settings for Family Games.</p>
      ) : state === 'on' ? (
        <>
          <p className="hint">On for this phone. You'll get a ping when a game starts or it's your turn.</p>
          <button className="pill" disabled={busy} onClick={() => run(disableNotifications)}>
            Turn off
          </button>
        </>
      ) : (
        <>
          <p className="hint">Get a ping when someone starts a game or it's your turn.</p>
          <button className="primary" disabled={busy} onClick={() => run(() => enableNotifications(uid))}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function InstallSetting() {
  const [canPrompt, install] = useInstallPrompt();
  return (
    <section className="set-row">
      <h4>📲 Install app</h4>
      {isStandalone() ? (
        <p className="hint">Installed. You're using the app version on this phone.</p>
      ) : canPrompt ? (
        <>
          <p className="hint">Adds an icon to your phone so it opens like an app.</p>
          <button className="primary" onClick={install}>
            Install app
          </button>
        </>
      ) : isIos() ? (
        <p className="hint">
          In Safari, tap the Share button, then <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <p className="hint">
          Open your browser's menu and pick <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      )}
    </section>
  );
}

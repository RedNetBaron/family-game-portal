import { useEffect, useState } from 'react';
import { disableNotifications, enableNotifications, notifyState, refreshToken, type NotifyState } from '../lib/notify';

/** "Turn on notifications" card for the Games page. Hidden when push isn't set up. */
export function NotifyCard({ uid }: { uid: string }) {
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

  if (state === 'loading' || state === 'unavailable') return null;

  if (state === 'on') {
    return (
      <p className="notify-on hint">
        🔔 Notifications are on for this phone.{' '}
        <button className="link" disabled={busy} onClick={() => run(disableNotifications)}>
          Turn off
        </button>
      </p>
    );
  }

  return (
    <div className="card notify">
      <h3>🔔 Get a ping when it's your turn</h3>
      {state === 'ios-install' ? (
        <p className="hint">
          On iPhone, first add Family Games to your Home Screen: tap the Share button, then <strong>Add to Home Screen</strong>.
          Open it from the new icon and this button will show up here.
        </p>
      ) : state === 'blocked' ? (
        <p className="hint">
          Notifications are blocked for this site. Turn them on in your phone's settings for Family Games, then come back.
        </p>
      ) : (
        <>
          <p className="hint">We'll let you know when someone starts a game or it's your turn to play.</p>
          <button className="primary" disabled={busy} onClick={() => run(() => enableNotifications(uid))}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { friendlyError, joinFamily, nameToLogin, signInMember } from '../lib/account';

export function Welcome({ invite }: { invite: string | null }) {
  const [mode, setMode] = useState<'join' | 'signin'>(invite ? 'join' : 'signin');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!nameToLogin(name)) {
      setError('Please enter a name with at least one letter or number.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'join' && invite) {
        await joinFamily(name, password, invite);
        history.replaceState(null, '', location.pathname);
        dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        await signInMember(name, password);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const joining = mode === 'join' && invite;

  return (
    <main className="welcome">
      <img className="hero-logo" src="/logo.png" alt="Game Master Red" width="220" height="220" />
      <h1 className="title">Jones Family Games</h1>
      <p className="tagline">Games and chat for the family.</p>
      <form className="card" onSubmit={submit}>
        <h2>{joining ? "You're invited! Pick a name" : 'Sign in'}</h2>
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            autoCapitalize="words"
            maxLength={30}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={joining ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'One moment…' : joining ? 'Join the family' : 'Sign in'}
        </button>
        {invite && (
          <button
            type="button"
            className="link"
            onClick={() => setMode(joining ? 'signin' : 'join')}
          >
            {joining ? 'Already joined? Sign in' : 'New here? Join with your invite'}
          </button>
        )}
        {!invite && (
          <p className="hint">New here? Ask for the family invite link.</p>
        )}
      </form>
    </main>
  );
}

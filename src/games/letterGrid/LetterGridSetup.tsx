import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { createGame, type Game, type Mode } from './api';
import { formatDuration, MAX_SECONDS, MIN_SECONDS, SIZES, TIMER_PRESETS } from './logic';
import { db } from '../../lib/firebase';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';

function gameStatus(g: Game, now: number, uid: string): { label: string; active: boolean } {
  const ends = g.endsAt?.toMillis() ?? null;
  if (g.mode === 'live') {
    if (g.status === 'lobby') return { label: 'Waiting for players', active: true };
    if (g.status === 'done') return { label: 'Finished', active: false };
    if (ends && now < ends) return { label: 'Playing now', active: true };
    return { label: 'Finished', active: false };
  }
  if (ends && now < ends) {
    const played = !!g.players[uid];
    const hrs = Math.max(1, Math.round((ends - now) / 3600_000));
    return { label: played ? `You played · ${hrs}h left for others` : `Your turn · ${hrs}h left`, active: !played };
  }
  return { label: 'Finished', active: false };
}

export function LetterGridSetup({ member }: { member: Member }) {
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState(4);
  const [preset, setPreset] = useState<number | 'custom'>(180);
  const [customMin, setCustomMin] = useState('2');
  const [customSec, setCustomSec] = useState('30');
  const now = useNow(30_000);

  const customSeconds = (parseInt(customMin, 10) || 0) * 60 + (parseInt(customSec, 10) || 0);
  const seconds = preset === 'custom' ? customSeconds : preset;
  const timeOk = seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) =>
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Game)),
    );
  }, []);

  async function start(mode: Mode) {
    setBusy(mode);
    setError('');
    try {
      const id = await createGame(member, mode, { size, seconds });
      location.hash = `#/game/${id}`;
    } catch {
      setError("Couldn't start a game. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="games">
      <header className="lg-head">
        <a href="#/games" className="link">‹ Games</a>
        <h2>Letter Grid</h2>
      </header>
      <article className="card game">
        <h3>New game</h3>
        <p>Find words in a grid of letters before time runs out. Longer words score more, and words someone else also found don't count.</p>

        <fieldset className="choice">
          <legend>Board size</legend>
          <div className="chips">
            {SIZES.map((n) => (
              <button key={n} type="button" className={size === n ? 'chip on' : 'chip'} aria-pressed={size === n} onClick={() => setSize(n)}>
                {n}×{n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice">
          <legend>Timer</legend>
          <div className="chips">
            {TIMER_PRESETS.map((t) => (
              <button key={t} type="button" className={preset === t ? 'chip on' : 'chip'} aria-pressed={preset === t} onClick={() => setPreset(t)}>
                {t / 60} min
              </button>
            ))}
            <button type="button" className={preset === 'custom' ? 'chip on' : 'chip'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>
              Custom
            </button>
          </div>
          {preset === 'custom' && (
            <div className="custom-time">
              <label>
                <input inputMode="numeric" value={customMin} maxLength={2} onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, ''))} aria-label="Minutes" />
                min
              </label>
              <label>
                <input inputMode="numeric" value={customSec} maxLength={2} onChange={(e) => setCustomSec(e.target.value.replace(/\D/g, ''))} aria-label="Seconds" />
                sec
              </label>
              {!timeOk && <span className="error">Pick between 30 seconds and 15 minutes.</span>}
            </div>
          )}
        </fieldset>

        <div className="mode-buttons">
          <button className="primary" disabled={!!busy || !timeOk} onClick={() => start('live')}>
            {busy === 'live' ? 'Starting…' : 'Play live'}
          </button>
          <button className="primary alt" disabled={!!busy || !timeOk} onClick={() => start('turns')}>
            {busy === 'turns' ? 'Starting…' : 'Take turns'}
          </button>
        </div>
        <p className="hint">
          {timeOk ? `${size}×${size} board, ${formatDuration(seconds)}. ` : ''}
          <strong>Live:</strong> everyone plays together. <strong>Take turns:</strong> everyone plays the same letters
          whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>

      {games.length > 0 && (
        <div className="card">
          <h3>Recent games</h3>
          <ul className="game-list">
            {games.map((g) => {
              const s = gameStatus(g, now, member.uid);
              return (
                <li key={g.id}>
                  <a href={`#/game/${g.id}`}>
                    <span>
                      Letter Grid {Math.round(Math.sqrt(g.grid.length))}×{Math.round(Math.sqrt(g.grid.length))}{' '}
                      {g.mode === 'live' ? '(live)' : '(take turns)'}
                      <small> by {g.createdByName}</small>
                    </span>
                    <span className={s.active ? 'badge hot' : 'badge'}>{s.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </section>
  );
}

import { useCallback, useState } from 'react';
import type { Member } from '../../lib/useMember';
import { ModeButtons, RecentGames, TimerChoice } from '../common/Phases';
import { createGame, type Game, type Mode } from './api';
import { formatDuration, SIZES, TIMER_PRESETS } from './logic';

export function LetterGridSetup({ member }: { member: Member }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState(4);
  const [seconds, setSeconds] = useState<number | null>(180);
  const onTimer = useCallback((s: number | null) => setSeconds(s), []);

  async function start(mode: Mode) {
    if (!seconds) return;
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
        <h2 className="with-icon"><img src="/icons/letter-grid.png" alt="" width="40" height="40" />Letter Grid</h2>
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

        <TimerChoice presets={TIMER_PRESETS} initial={180} onChange={onTimer} />
        <ModeButtons disabled={!seconds} busy={busy} onStart={start} />
        <p className="hint">
          {seconds ? `${size}×${size} board, ${formatDuration(seconds)}. ` : ''}
          <strong>Live:</strong> everyone plays together. <strong>Take turns:</strong> everyone plays the same letters
          whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>

      <RecentGames<Game> type="letterGrid" member={member} describe={(g) => `Letter Grid ${Math.round(Math.sqrt(g.grid.length))}×${Math.round(Math.sqrt(g.grid.length))}`} />
    </section>
  );
}

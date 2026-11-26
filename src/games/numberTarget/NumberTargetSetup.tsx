import { useState } from 'react';
import type { Member } from '../../lib/useMember';
import type { Mode } from '../common/api';
import { ModeButtons, RecentGames } from '../common/Phases';
import { formatDuration } from '../letterGrid/logic';
import { createNumberTargetGame, type NumberTargetGame } from './api';
import { BIG_CHOICES, bigLabel, MAX_PER_ROUND, MIN_PER_ROUND, PER_ROUND_PRESETS, ROUND_COUNTS, roundSeconds } from './logic';

export function NumberTargetSetup({ member }: { member: Member }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [rounds, setRounds] = useState(3);
  const [preset, setPreset] = useState<number | 'custom'>(60);
  const [custom, setCustom] = useState('45');
  const [big, setBig] = useState<'mix' | number>('mix');

  const perRound = preset === 'custom' ? parseInt(custom, 10) || 0 : preset;
  const timeOk = perRound >= MIN_PER_ROUND && perRound <= MAX_PER_ROUND;

  async function start(mode: Mode) {
    if (!timeOk) return;
    setBusy(mode);
    setError('');
    try {
      const id = await createNumberTargetGame(member, mode, { rounds, perRound, big });
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
        <h2 className="with-icon"><img src="/icons/number-target.png" alt="" width="40" height="40" />Number Target</h2>
      </header>

      <a className="card menu-item" href="#/games/daily-target">
        <span>
          <strong>🎯 Daily Target</strong>
          <small>One puzzle a day for the whole family, 2 minutes. Counts toward the monthly scoreboard.</small>
        </span>
        <span className="chev" aria-hidden="true">›</span>
      </a>

      <article className="card game">
        <h3>New game</h3>
        <p>
          Everyone gets the same six numbers and a target. Combine numbers with + − × ÷ to get as close as you can.
          Exact hits score 10, plus up to 5 more for speed. Within 5 scores 7, within 10 scores 5, within 25 scores 2.
        </p>

        <fieldset className="choice">
          <legend>Rounds</legend>
          <div className="chips">
            {ROUND_COUNTS.map((n) => (
              <button key={n} type="button" className={rounds === n ? 'chip on' : 'chip'} aria-pressed={rounds === n} onClick={() => setRounds(n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice">
          <legend>Time per round</legend>
          <div className="chips">
            {PER_ROUND_PRESETS.map((t) => (
              <button key={t} type="button" className={preset === t ? 'chip on' : 'chip'} aria-pressed={preset === t} onClick={() => setPreset(t)}>
                {t} sec
              </button>
            ))}
            <button type="button" className={preset === 'custom' ? 'chip on' : 'chip'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>
              Custom
            </button>
          </div>
          {preset === 'custom' && (
            <div className="custom-time">
              <label>
                <input inputMode="numeric" value={custom} maxLength={3} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Seconds per round" />
                sec
              </label>
              {!timeOk && <span className="error">Pick between {MIN_PER_ROUND} and {MAX_PER_ROUND} seconds.</span>}
            </div>
          )}
        </fieldset>

        <fieldset className="choice">
          <legend>Big numbers (25, 50, 75, 100)</legend>
          <div className="chips">
            {BIG_CHOICES.map((b) => (
              <button key={String(b)} type="button" className={big === b ? 'chip on' : 'chip'} aria-pressed={big === b} onClick={() => setBig(b)}>
                {bigLabel(b)}
              </button>
            ))}
          </div>
        </fieldset>

        <ModeButtons disabled={!timeOk} busy={busy} onStart={start} />
        <p className="hint">
          {timeOk ? `${rounds} ${rounds === 1 ? 'round' : 'rounds'}, ${perRound} seconds each (about ${formatDuration(Math.ceil(roundSeconds(rounds, perRound) / 60) * 60)} in all). ` : ''}
          <strong>Live:</strong> everyone plays together. <strong>Take turns:</strong> everyone gets the same numbers
          whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>
      <RecentGames<NumberTargetGame>
        type="numberTarget"
        member={member}
        describe={(g) => `Number Target (${g.puzzles.length} ${g.puzzles.length === 1 ? 'round' : 'rounds'})`}
      />
    </section>
  );
}

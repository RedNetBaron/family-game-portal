import { useState } from 'react';
import type { Member } from '../../lib/useMember';
import type { Mode } from '../common/api';
import { ModeButtons, RecentGames } from '../common/Phases';
import { createMathSprintGame, type MathSprintGame } from './api';
import { LEVELS, MAX_SECONDS, MIN_SECONDS, TIMER_PRESETS, type Level } from './logic';

export const timeLabel = (s: number) => (s < 60 || s % 60 ? `${s} sec` : `${s / 60} min`);

export function MathSprintSetup({ member }: { member: Member }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [level, setLevel] = useState<Level>('medium');
  const [preset, setPreset] = useState<number | 'custom'>(60);
  const [custom, setCustom] = useState('90');

  const seconds = preset === 'custom' ? parseInt(custom, 10) || 0 : preset;
  const timeOk = seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;

  async function start(mode: Mode) {
    if (!timeOk) return;
    setBusy(mode);
    setError('');
    try {
      const id = await createMathSprintGame(member, mode, { level, seconds });
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
        <h2 className="with-icon"><img src="/icons/math-sprint.png" alt="" width="40" height="40" />Math Sprint</h2>
      </header>
      <article className="card game">
        <h3>New game</h3>
        <p>Solve as many problems as you can before the clock runs out. Everyone gets the same problems in the same order. One point per right answer.</p>

        <fieldset className="choice">
          <legend>Level</legend>
          <div className="chips">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className={level === l.id ? 'chip on' : 'chip'} aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="hint">{LEVELS.find((l) => l.id === level)!.blurb}.</p>
        </fieldset>

        <fieldset className="choice">
          <legend>Timer</legend>
          <div className="chips">
            {TIMER_PRESETS.map((t) => (
              <button key={t} type="button" className={preset === t ? 'chip on' : 'chip'} aria-pressed={preset === t} onClick={() => setPreset(t)}>
                {timeLabel(t)}
              </button>
            ))}
            <button type="button" className={preset === 'custom' ? 'chip on' : 'chip'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>
              Custom
            </button>
          </div>
          {preset === 'custom' && (
            <div className="custom-time">
              <label>
                <input inputMode="numeric" value={custom} maxLength={3} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Seconds" />
                sec
              </label>
              {!timeOk && <span className="error">Pick between {MIN_SECONDS} seconds and {MAX_SECONDS / 60} minutes.</span>}
            </div>
          )}
        </fieldset>

        <ModeButtons disabled={!timeOk} busy={busy} onStart={start} />
        <p className="hint">
          <strong>Live:</strong> everyone races at the same time. <strong>Take turns:</strong> everyone gets the same
          problems whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>
      <RecentGames<MathSprintGame>
        type="mathSprint"
        member={member}
        describe={(g) => `Math Sprint (${LEVELS.find((l) => l.id === g.level)?.label ?? ''}, ${timeLabel(g.seconds)})`}
      />
    </section>
  );
}

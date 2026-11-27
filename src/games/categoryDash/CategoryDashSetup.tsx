import { useCallback, useState } from 'react';
import type { Member } from '../../lib/useMember';
import type { Mode } from '../common/api';
import { ModeButtons, RecentGames, TimerChoice } from '../common/Phases';
import { formatDuration } from '../letterGrid/logic';
import { createCategoryGame, type CategoryGame } from './api';
import { CATEGORY_COUNTS, TIMER_PRESETS } from './logic';

export function CategoryDashSetup({ member }: { member: Member }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [count, setCount] = useState(9);
  const [seconds, setSeconds] = useState<number | null>(120);
  const onTimer = useCallback((s: number | null) => setSeconds(s), []);

  async function start(mode: Mode) {
    if (!seconds) return;
    setBusy(mode);
    setError('');
    try {
      const id = await createCategoryGame(member, mode, { count, seconds });
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
        <h2 className="with-icon"><img src="/icons/category-dash.png" alt="" width="40" height="40" />Category Dash</h2>
      </header>
      <article className="card game">
        <h3>New game</h3>
        <p>
          You get one random letter and a list of categories. Think of something for each category that starts with
          that letter. Answers nobody else gave score a point. If every main word of an answer starts with the letter, it
          scores a point per word (“Bed Bath and Beyond” is 3 for B), and the family can vote out answers that don't fit.
        </p>
        <fieldset className="choice">
          <legend>Categories</legend>
          <div className="chips">
            {CATEGORY_COUNTS.map((n) => (
              <button key={n} type="button" className={count === n ? 'chip on' : 'chip'} aria-pressed={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <TimerChoice presets={TIMER_PRESETS} initial={120} onChange={onTimer} />
        <ModeButtons disabled={!seconds} busy={busy} onStart={start} />
        <p className="hint">
          {seconds ? `${count} categories, ${formatDuration(seconds)}. ` : ''}
          <strong>Live:</strong> everyone plays together. <strong>Take turns:</strong> everyone gets the same letter and
          categories whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>
      <RecentGames<CategoryGame>
        type="categoryDash"
        member={member}
        describe={(g) => `Category Dash (${g.categories.length})`}
      />
    </section>
  );
}

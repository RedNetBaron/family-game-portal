import { useState } from 'react';
import type { Member } from '../../lib/useMember';
import type { Mode } from '../common/api';
import { ModeButtons, RecentGames } from '../common/Phases';
import { createTriviaGame, type TriviaGame } from './api';
import { MAX_PER_QUESTION, MIN_PER_QUESTION, PER_QUESTION_PRESETS, QUESTION_COUNTS, roundSeconds } from './logic';
import { BANK, CATEGORIES, type Category } from './questions';
import { formatDuration } from '../letterGrid/logic';

export function TriviaSetup({ member }: { member: Member }) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [cats, setCats] = useState<Category[]>(CATEGORIES);
  const [count, setCount] = useState(10);
  const [preset, setPreset] = useState<number | 'custom'>(20);
  const [custom, setCustom] = useState('15');

  const perQuestion = preset === 'custom' ? parseInt(custom, 10) || 0 : preset;
  const timeOk = perQuestion >= MIN_PER_QUESTION && perQuestion <= MAX_PER_QUESTION;
  const available = cats.reduce((n, c) => n + BANK[c].length, 0);
  const all = cats.length === CATEGORIES.length;

  function toggle(c: Category) {
    if (all) return setCats([c]);
    const next = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    setCats(next.length ? next : CATEGORIES);
  }

  async function start(mode: Mode) {
    if (!timeOk) return;
    setBusy(mode);
    setError('');
    try {
      const id = await createTriviaGame(member, mode, { categories: cats, count: Math.min(count, available), perQuestion });
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
        <h2 className="with-icon"><img src="/icons/trivia.png" alt="" width="40" height="40" />Family Trivia</h2>
      </header>
      <article className="card game">
        <h3>New game</h3>
        <p>Multiple-choice questions with a family scoreboard. Right answers score 100, plus a bonus for being quick.</p>

        <fieldset className="choice">
          <legend>Categories</legend>
          <div className="chips">
            <button type="button" className={all ? 'chip on' : 'chip'} aria-pressed={all} onClick={() => setCats(CATEGORIES)}>
              Mixed (all)
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={!all && cats.includes(c) ? 'chip on' : 'chip'} aria-pressed={!all && cats.includes(c)} onClick={() => toggle(c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice">
          <legend>Questions</legend>
          <div className="chips">
            {QUESTION_COUNTS.map((n) => (
              <button key={n} type="button" className={count === n ? 'chip on' : 'chip'} aria-pressed={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
          {count > available && <p className="hint">Only {available} questions in those categories, so you'll get {available}.</p>}
        </fieldset>

        <fieldset className="choice">
          <legend>Time per question</legend>
          <div className="chips">
            {PER_QUESTION_PRESETS.map((t) => (
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
                <input inputMode="numeric" value={custom} maxLength={2} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Seconds per question" />
                sec
              </label>
              {!timeOk && <span className="error">Pick between {MIN_PER_QUESTION} and {MAX_PER_QUESTION} seconds.</span>}
            </div>
          )}
        </fieldset>

        <ModeButtons disabled={!timeOk} busy={busy} onStart={start} />
        <p className="hint">
          {timeOk
            ? `${Math.min(count, available)} questions, ${perQuestion} seconds each (about ${formatDuration(Math.ceil(roundSeconds(Math.min(count, available), perQuestion) / 60) * 60)} in all). `
            : ''}
          <strong>Live:</strong> everyone plays together. <strong>Take turns:</strong> everyone gets the same questions
          whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>
      <RecentGames<TriviaGame> type="trivia" member={member} describe={(g) => `Family Trivia (${g.questions.length} Qs)`} />
    </section>
  );
}

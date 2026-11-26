import { useEffect, useState } from 'react';
import { notifyState } from '../lib/notify';
import { openSettings } from './SettingsSheet';
import type { Waiting } from '../lib/useWaiting';
import { GAME_NAMES } from '../lib/useWaiting';
import { useMenuView } from '../lib/useMenuView';

const games: { name: string; blurb: string; href: string | null; icon: string }[] = [
  {
    name: 'Daily Word',
    blurb: 'One mystery word a day for the whole family. Six guesses.',
    href: '#/games/daily-word',
    icon: '/icons/daily-word.png',
  },
  {
    name: 'Daily Target',
    blurb: 'One number puzzle a day for the whole family. Two minutes.',
    href: '#/games/daily-target',
    icon: '/icons/daily-target.png',
  },
  {
    name: 'Letter Grid',
    blurb: 'Find words in a grid of letters before time runs out.',
    href: '#/games/letter-grid',
    icon: '/icons/letter-grid.png',
  },
  {
    name: 'Category Dash',
    blurb: 'One letter, a list of categories. Fill them in fast.',
    href: '#/games/category-dash',
    icon: '/icons/category-dash.png',
  },
  {
    name: 'Family Trivia',
    blurb: 'Multiple-choice questions with a family scoreboard.',
    href: '#/games/trivia',
    icon: '/icons/trivia.png',
  },
  {
    name: 'Number Target',
    blurb: 'Six numbers, one target. Use + − × ÷ to get as close as you can.',
    href: '#/games/number-target',
    icon: '/icons/number-target.png',
  },
  {
    name: 'Math Sprint',
    blurb: 'Solve as many quick math problems as you can before time runs out.',
    href: '#/games/math-sprint',
    icon: '/icons/math-sprint.png',
  },
];

export function Games({ waiting }: { waiting: Waiting[]; uid: string }) {
  const [view] = useMenuView();
  return (
    <section className="games">
      {waiting.length > 0 && (
        <div className="card your-turn">
          <h3>Waiting on you</h3>
          <ul className="game-list">
            {waiting.map(({ game, kind, hoursLeft }) => (
              <li key={game.id}>
                <a href={kind === 'daily' ? (game.type === 'dailyTarget' ? '#/games/daily-target' : '#/games/daily-word') : `#/game/${game.id}`}>
                  <span>
                    {GAME_NAMES[game.type] ?? 'Game'}
                    <small>{kind === 'daily' ? ' · today' : ` by ${game.createdByName}`}</small>
                  </span>
                  <span className="badge hot">{kind === 'lobby' ? 'Live now · join' : kind === 'daily' ? 'Not played yet' : `Your turn · ${hoursLeft}h left`}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <NotifyNudge />
      <h2 className="menu-title">Pick a game</h2>
      <ul className={`game-menu ${view}`}>
        {games.map((g) => (
          <li key={g.name}>
            {g.href ? (
              <a className="card menu-item" href={g.href}>
                <img className="menu-icon" src={g.icon} alt="" width="56" height="56" />
                <span>
                  <strong>{g.name}</strong>
                  <small>{g.blurb}</small>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </a>
            ) : (
              <div className="card menu-item soon" aria-disabled="true">
                <img className="menu-icon" src={g.icon} alt="" width="56" height="56" />
                <span>
                  <strong>{g.name}</strong>
                  <small>{g.blurb}</small>
                </span>
                <span className="badge">Coming soon</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One-line reminder while notifications are off; the switch itself is in Settings. */
function NotifyNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    notifyState().then((s) => setShow(s === 'off' || s === 'ios-install'));
  }, []);
  if (!show) return null;
  return (
    <button className="nudge" onClick={openSettings}>
      🔔 Want a ping when it's your turn? <span>Turn on in Settings</span>
    </button>
  );
}

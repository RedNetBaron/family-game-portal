import { InstallButton } from './InstallButton';
import { NotifyCard } from './NotifyCard';
import type { Waiting } from '../lib/useWaiting';
import { GAME_NAMES } from '../lib/useWaiting';

const games: { name: string; blurb: string; href: string | null }[] = [
  {
    name: 'Daily Word',
    blurb: 'One mystery word a day for the whole family. Six guesses.',
    href: '#/games/daily-word',
  },
  {
    name: 'Daily Target',
    blurb: 'One number puzzle a day for the whole family. Two minutes.',
    href: '#/games/daily-target',
  },
  {
    name: 'Letter Grid',
    blurb: 'Find words in a grid of letters before time runs out.',
    href: '#/games/letter-grid',
  },
  {
    name: 'Category Dash',
    blurb: 'One letter, a list of categories. Fill them in fast.',
    href: '#/games/category-dash',
  },
  {
    name: 'Family Trivia',
    blurb: 'Multiple-choice questions with a family scoreboard.',
    href: '#/games/trivia',
  },
  {
    name: 'Number Target',
    blurb: 'Six numbers, one target. Use + − × ÷ to get as close as you can.',
    href: '#/games/number-target',
  },
  {
    name: 'Math Sprint',
    blurb: 'Solve as many quick math problems as you can before time runs out.',
    href: '#/games/math-sprint',
  },
];

export function Games({ waiting, uid }: { waiting: Waiting[]; uid: string }) {
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
      <InstallButton />
      <NotifyCard uid={uid} />
      <h2 className="menu-title">Pick a game</h2>
      <ul className="game-menu">
        {games.map((g) => (
          <li key={g.name}>
            {g.href ? (
              <a className="card menu-item" href={g.href}>
                <span>
                  <strong>{g.name}</strong>
                  <small>{g.blurb}</small>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </a>
            ) : (
              <div className="card menu-item soon" aria-disabled="true">
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

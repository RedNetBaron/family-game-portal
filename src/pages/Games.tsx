import { InstallButton } from './InstallButton';
import { NotifyCard } from './NotifyCard';
import type { Waiting } from '../lib/useWaiting';
import { GAME_NAMES } from '../lib/useWaiting';

const games: { name: string; blurb: string; href: string | null }[] = [
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
                <a href={`#/game/${game.id}`}>
                  <span>
                    {GAME_NAMES[game.type] ?? 'Game'}
                    <small> by {game.createdByName}</small>
                  </span>
                  <span className="badge hot">{kind === 'lobby' ? 'Live now · join' : `Your turn · ${hoursLeft}h left`}</span>
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

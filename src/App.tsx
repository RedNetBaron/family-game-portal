import { useEffect } from 'react';
import { joinInProgress, signOutMember } from './lib/account';
import { useHash } from './lib/useHash';
import { useMember } from './lib/useMember';
import { Chat } from './pages/Chat';
import { LetterGridGame } from './games/letterGrid/LetterGridGame';
import { LetterGridSetup } from './games/letterGrid/LetterGridSetup';
import { Games } from './pages/Games';
import { Welcome } from './pages/Welcome';

export function App() {
  const state = useMember();
  const hash = useHash();
  const invite = hash.match(/^#\/join\/([A-Za-z0-9_-]{4,64})$/)?.[1] ?? null;

  // A signed-in account that isn't a family member (outside of a join in
  // progress) is signed out so the sign-in form works normally.
  useEffect(() => {
    if (state.status === 'not-member' && !joinInProgress) signOutMember();
  }, [state.status]);

  // While joining, the new account briefly exists before it becomes a member,
  // so keep the join form on screen (and its error message, if the join fails).
  if (
    state.status === 'signed-out' ||
    state.status === 'not-member' ||
    (joinInProgress && state.status === 'loading')
  ) {
    return <Welcome invite={invite} />;
  }

  if (state.status === 'loading') {
    return <main className="center">Loading…</main>;
  }

  const gameId = hash.match(/^#\/game\/([A-Za-z0-9]+)$/)?.[1] ?? null;
  const tab = gameId || hash.startsWith('#/games') ? 'games' : 'chat';

  return (
    <div className="shell">
      <header className="top">
        <span className="brand">
          <img src="/logo-badge.png" alt="" width="36" height="36" />
          Family Games
        </span>
        <button className="link" onClick={signOutMember}>Sign out</button>
      </header>
      <div className="content">
        {gameId ? (
          <LetterGridGame key={gameId} gameId={gameId} member={state.member} />
        ) : hash === '#/games/letter-grid' ? (
          <LetterGridSetup member={state.member} />
        ) : tab === 'chat' ? (
          <Chat member={state.member} />
        ) : (
          <Games />
        )}
      </div>
      <nav className="tabs">
        <a className={tab === 'chat' ? 'active' : ''} href="#/chat">
          Chat
        </a>
        <a className={tab === 'games' ? 'active' : ''} href="#/games">
          Games
        </a>
      </nav>
    </div>
  );
}

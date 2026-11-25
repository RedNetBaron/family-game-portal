import { useEffect, useState } from 'react';
import { joinInProgress, signOutMember } from './lib/account';
import { useHash } from './lib/useHash';
import { useMember, type Member } from './lib/useMember';
import { useWaiting } from './lib/useWaiting';
import { Chat } from './pages/Chat';
import { CategoryDashSetup } from './games/categoryDash/CategoryDashSetup';
import { GameScreen } from './games/GameScreen';
import { TriviaSetup } from './games/trivia/TriviaSetup';
import { LetterGridSetup } from './games/letterGrid/LetterGridSetup';
import { Games } from './pages/Games';
import { Scores } from './pages/Scores';
import { LogoSheet } from './pages/LogoSheet';
import { DailyWord } from './games/dailyWord/DailyWord';
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

  return <Shell member={state.member} hash={hash} />;
}

function Shell({ member, hash }: { member: Member; hash: string }) {
  const waiting = useWaiting(member.uid);
  const [logoOpen, setLogoOpen] = useState(false);
  const gameId = hash.match(/^#\/game\/([A-Za-z0-9]+)$/)?.[1] ?? null;
  const tab = gameId || hash.startsWith('#/games') ? 'games' : hash.startsWith('#/scores') ? 'scores' : 'chat';

  return (
    <div className="shell">
      <header className="top">
        <button className="brand" onClick={() => setLogoOpen(true)} aria-label="Show logo and invite link">
          <img src="/logo-badge.png" alt="" width="36" height="36" />
          Family Games
        </button>
        <button className="link" onClick={signOutMember}>Sign out</button>
      </header>
      <div className="content">
        {gameId ? (
          <GameScreen key={gameId} gameId={gameId} member={member} />
        ) : hash === '#/games/daily-word' ? (
          <DailyWord member={member} />
        ) : tab === 'scores' ? (
          <Scores member={member} />
        ) : hash === '#/games/trivia' ? (
          <TriviaSetup member={member} />
        ) : hash === '#/games/category-dash' ? (
          <CategoryDashSetup member={member} />
        ) : hash === '#/games/letter-grid' ? (
          <LetterGridSetup member={member} />
        ) : tab === 'chat' ? (
          <Chat member={member} />
        ) : (
          <Games waiting={waiting} uid={member.uid} />
        )}
      </div>
      {logoOpen && <LogoSheet member={member} onClose={() => setLogoOpen(false)} />}
      <nav className="tabs">
        <a className={tab === 'chat' ? 'active' : ''} href="#/chat">
          Chat
        </a>
        <a className={tab === 'games' ? 'active' : ''} href="#/games">
          Games
          {waiting.length > 0 && <span className="tab-count" aria-label={`${waiting.length} waiting on you`}>{waiting.length}</span>}
        </a>
        <a className={tab === 'scores' ? 'active' : ''} href="#/scores">
          Scores
        </a>
      </nav>
    </div>
  );
}

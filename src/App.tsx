import { useEffect, useState } from 'react';
import { joinInProgress, signOutMember } from './lib/account';
import { useHash } from './lib/useHash';
import { useMember, type Member } from './lib/useMember';
import { useWaiting } from './lib/useWaiting';
import { SettingsButton } from './pages/SettingsSheet';
import { Chat } from './pages/Chat';
import { CategoryDashSetup } from './games/categoryDash/CategoryDashSetup';
import { GameScreen } from './games/GameScreen';
import { TriviaSetup } from './games/trivia/TriviaSetup';
import { LetterGridSetup } from './games/letterGrid/LetterGridSetup';
import { Games } from './pages/Games';
import { Scores } from './pages/Scores';
import { LogoSheet } from './pages/LogoSheet';
import { DailyWord } from './games/dailyWord/DailyWord';
import { DailyTarget } from './games/numberTarget/DailyTarget';
import { NumberTargetSetup } from './games/numberTarget/NumberTargetSetup';
import { MathSprintSetup } from './games/mathSprint/MathSprintSetup';
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
        <div className="top-actions">
          <SettingsButton uid={member.uid} />
          <ProfileMenu name={member.name} />
        </div>
      </header>
      <div className="content">
        {gameId ? (
          <GameScreen key={gameId} gameId={gameId} member={member} />
        ) : hash === '#/games/daily-word' ? (
          <DailyWord member={member} />
        ) : hash === '#/games/daily-target' ? (
          <DailyTarget member={member} />
        ) : tab === 'scores' ? (
          <Scores member={member} />
        ) : hash === '#/games/trivia' ? (
          <TriviaSetup member={member} />
        ) : hash === '#/games/number-target' ? (
          <NumberTargetSetup member={member} />
        ) : hash === '#/games/math-sprint' ? (
          <MathSprintSetup member={member} />
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
          <img src="/icons/chat.png" alt="" width="34" height="34" />
          Chat
        </a>
        <a className={tab === 'games' ? 'active' : ''} href="#/games">
          <img src="/icons/games.png" alt="" width="34" height="34" />
          Games
          {waiting.length > 0 && <span className="tab-count" aria-label={`${waiting.length} waiting on you`}>{waiting.length}</span>}
        </a>
        <a className={tab === 'scores' ? 'active' : ''} href="#/scores">
          <img src="/icons/scores.png" alt="" width="34" height="34" />
          Scores
        </a>
      </nav>
    </div>
  );
}

function ProfileMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="profile-menu">
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Profile" aria-expanded={open}>
        <img src="/icons/profile.png" alt="" width="36" height="36" />
      </button>
      {open && (
        <div className="profile-pop card">
          <div className="hint">Signed in as</div>
          <strong>{name}</strong>
          <button className="link" onClick={signOutMember}>Sign out</button>
        </div>
      )}
    </div>
  );
}


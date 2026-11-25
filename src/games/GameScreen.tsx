import type { Member } from '../lib/useMember';
import { CategoryDashGame } from './categoryDash/CategoryDashGame';
import type { BaseGame } from './common/api';
import { useGame } from './common/Phases';
import { LetterGridGame } from './letterGrid/LetterGridGame';
import { TriviaGame } from './trivia/TriviaGame';

/** Opens a game by id, whatever its type. */
export function GameScreen({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<BaseGame>(gameId);
  if (game === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;
  if (game.type === 'trivia') return <TriviaGame gameId={gameId} member={member} />;
  if (game.type === 'categoryDash') return <CategoryDashGame gameId={gameId} member={member} />;
  return <LetterGridGame gameId={gameId} member={member} />;
}

import { useCallback, useEffect, useRef } from 'react';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { beginPlay, markDone, saveWords, submitPlay, type Play } from '../common/api';
import { CloseEarly, Countdown, Lobby, ms, RecordResult, TurnIntro, useGame, useMyPlay, usePlays } from '../common/Phases';
import type { MathSprintGame as Game } from './api';
import { answerOf, LEVELS, scoreSprint, showProblem } from './logic';
import { timeLabel } from './MathSprintSetup';
import { SprintRunner } from './SprintRunner';

export function MathSprintGame({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<Game>(gameId);
  const myPlay = useMyPlay(gameId, member.uid);
  const now = useNow(500);

  if (game === undefined || myPlay === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;

  const endsAt = ms(game.endsAt);
  const startAt = ms(game.startAt);
  const submitted = !!myPlay?.submittedAt;
  const gameOver = endsAt !== null && now > endsAt;
  const level = LEVELS.find((l) => l.id === game.level)?.label ?? '';

  let body: React.ReactNode;
  if (game.mode === 'live') {
    const joined = !!game.players[member.uid];
    if (game.status === 'lobby') {
      body = <Lobby game={game} member={member} joined={joined} what={`${level.toLowerCase()} problems`} />;
    } else if (!joined) {
      body = gameOver ? <Results game={game} member={member} /> : <p className="card">This round started without you. Results will show here when it ends.</p>;
    } else if (startAt !== null && now < startAt) {
      body = <Countdown seconds={Math.ceil((startAt - now) / 1000)} />;
    } else if (!submitted && endsAt !== null && now < endsAt + 5000) {
      body = <PlayRound game={game} member={member} play={myPlay} deadline={endsAt} />;
    } else {
      body = <Results game={game} member={member} />;
    }
  } else {
    const myDeadline = myPlay?.startedAt ? ms(myPlay.startedAt)! + game.seconds * 1000 : null;
    if (submitted || gameOver) {
      body = <Results game={game} member={member} />;
    } else if (!myPlay) {
      body = (
        <TurnIntro game={game} member={member}>
          You'll get <strong>{timeLabel(game.seconds)}</strong> to solve as many <strong>{level.toLowerCase()}</strong> problems as
          you can. Type the answer and it moves on by itself when it's right.
        </TurnIntro>
      );
    } else if (myDeadline !== null) {
      body = <PlayRound game={game} member={member} play={myPlay} deadline={myDeadline} />;
    }
  }

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/math-sprint" className="link">‹ Math Sprint</a>
        <h2>{game.mode === 'live' ? 'Live game' : 'Take turns'}</h2>
        <span className="badge">
          {level} · {timeLabel(game.seconds)}
        </span>
      </header>
      {body}
    </section>
  );
}

function PlayRound({ game, member, play, deadline }: { game: Game; member: Member; play: Play | null; deadline: number }) {
  const started = useRef(false);
  useEffect(() => {
    if (!play && !started.current) {
      started.current = true;
      beginPlay(game, member).catch(() => undefined);
    }
  }, [play, game, member]);

  const onProgress = useCallback((a: string[]) => {
    saveWords(game.id, member.uid, a).catch(() => undefined);
  }, [game.id, member.uid]);
  const onFinish = useCallback((a: string[]) => {
    submitPlay(game.id, member.uid, a).catch(() => undefined);
  }, [game.id, member.uid]);

  if (!play) return <p className="center">Starting…</p>;
  return <SprintRunner problems={game.problems} seconds={game.seconds} deadline={deadline} initial={play.words} onProgress={onProgress} onFinish={onFinish} />;
}

function Results({ game, member }: { game: Game; member: Member }) {
  const plays = usePlays(game.id);
  const now = useNow(1000);
  if (!plays) return <p className="center">Loading results…</p>;

  const done = plays.filter((p) => p.submittedAt);
  const endsAt = ms(game.endsAt);
  const over = endsAt !== null && now > endsAt + (game.mode === 'live' ? 5000 : 0);
  const waiting = Object.entries(game.players)
    .filter(([uid]) => !done.some((p) => p.uid === uid))
    .map(([, name]) => name);
  const final = over || (game.mode === 'live' && waiting.length === 0);
  const standings = scoreSprint(game.problems, done.map((p) => ({ uid: p.uid, name: p.name, answers: p.words })));
  if (final && game.mode === 'live' && game.status === 'started' && game.createdBy === member.uid) markDone(game.id);

  // The problems people skipped most.
  const skips = new Map<number, number>();
  done.forEach((p) => p.words.forEach((a, i) => a === '-' && skips.set(i, (skips.get(i) ?? 0) + 1)));
  const hardest = [...skips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mine = done.find((p) => p.uid === member.uid);

  return (
    <div className="lg-results">
      <RecordResult game={game} over={final} rows={standings.map((r) => ({ uid: r.uid, name: r.name, score: r.score }))} />
      <div className="card">
        <h3>{final ? 'Final results' : 'Standings so far'}</h3>
        {!final && (
          <p className="hint">
            {waiting.length ? `Still playing: ${waiting.join(', ')}. ` : ''}
            {game.mode === 'turns' && endsAt ? `Others can play until ${new Date(endsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}
          </p>
        )}
        <CloseEarly game={game} member={member} />
        <ol className="lg-standings">
          {standings.map((r, i) => (
            <li key={r.uid} className={r.uid === member.uid ? 'me' : ''}>
              <span className="place">{final && i === 0 && r.score > 0 ? '🏆' : `${i + 1}.`}</span>
              <span className="who">
                {r.name} {r.skipped > 0 && <small className="hint">{r.skipped} skipped</small>}
              </span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ol>
        <p className="hint">One point per right answer.</p>
      </div>
      {mine && mine.words.some((a) => a === '-') && (
        <details className="card tq-review">
          <summary>Problems you skipped</summary>
          <ul className="plain-list">
            {mine.words.map((a, i) => (a === '-' ? <li key={i}>{showProblem(game.problems[i])} = <strong>{answerOf(game.problems[i])}</strong></li> : null))}
          </ul>
        </details>
      )}
      {hardest.length > 0 && done.length > 1 && (
        <details className="card tq-review">
          <summary>Most skipped</summary>
          <ul className="plain-list">
            {hardest.map(([i, n]) => (
              <li key={i}>
                {showProblem(game.problems[i])} = <strong>{answerOf(game.problems[i])}</strong> <span className="hint">({n} skipped)</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

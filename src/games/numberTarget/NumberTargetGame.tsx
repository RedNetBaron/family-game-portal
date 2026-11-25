import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bestSolution, OP_SYMBOL } from '../../../functions/shared/numbers.js';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { beginPlay, markDone, saveWords, submitPlay, type Play } from '../common/api';
import { CloseEarly, Countdown, Lobby, ms, RecordResult, TurnIntro, useGame, useMyPlay, usePlays } from '../common/Phases';
import type { NumberTargetGame as Game } from './api';
import { roundResult, scoreNumberTarget } from './logic';
import { NumberRunner } from './NumberRunner';

export function NumberTargetGame({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<Game>(gameId);
  const myPlay = useMyPlay(gameId, member.uid);
  const now = useNow(500);

  if (game === undefined || myPlay === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;

  const endsAt = ms(game.endsAt);
  const startAt = ms(game.startAt);
  const submitted = !!myPlay?.submittedAt;
  const gameOver = endsAt !== null && now > endsAt;
  const n = game.puzzles.length;
  const roundsText = `${n} ${n === 1 ? 'round' : 'rounds'}`;

  let body: React.ReactNode;
  if (game.mode === 'live') {
    const joined = !!game.players[member.uid];
    if (game.status === 'lobby') {
      body = <Lobby game={game} member={member} joined={joined} what={`numbers (${roundsText})`} />;
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
          You'll get <strong>{roundsText}</strong> with <strong>{game.perRound} seconds</strong> each. Tap a number, an
          operation, then another number to combine them. Get as close to the target as you can.
        </TurnIntro>
      );
    } else if (myDeadline !== null) {
      body = <PlayRound game={game} member={member} play={myPlay} deadline={myDeadline} />;
    }
  }

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/number-target" className="link">‹ Number Target</a>
        <h2>{game.mode === 'live' ? 'Live game' : 'Take turns'}</h2>
        <span className="badge">
          {roundsText} · {game.perRound}s
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

  const onRound = useCallback((rounds: string[]) => {
    saveWords(game.id, member.uid, rounds).catch(() => undefined);
  }, [game.id, member.uid]);
  const onFinish = useCallback((rounds: string[]) => {
    submitPlay(game.id, member.uid, rounds).catch(() => undefined);
  }, [game.id, member.uid]);

  if (!play) return <p className="center">Starting…</p>;
  return <NumberRunner puzzles={game.puzzles} perRound={game.perRound} deadline={deadline} initial={play.words} onRound={onRound} onFinish={onFinish} />;
}

function Results({ game, member }: { game: Game; member: Member }) {
  const plays = usePlays(game.id);
  const now = useNow(1000);
  const solutions = useMemo(() => game.puzzles.map((p) => bestSolution(p.numbers, p.target)), [game.puzzles]);
  if (!plays) return <p className="center">Loading results…</p>;

  const done = plays.filter((p) => p.submittedAt);
  const endsAt = ms(game.endsAt);
  const over = endsAt !== null && now > endsAt + (game.mode === 'live' ? 5000 : 0);
  const waiting = Object.entries(game.players)
    .filter(([uid]) => !done.some((p) => p.uid === uid))
    .map(([, name]) => name);
  const final = over || (game.mode === 'live' && waiting.length === 0);
  const standings = scoreNumberTarget(game.puzzles, game.perRound, done.map((p) => ({ uid: p.uid, name: p.name, rounds: p.words })));

  if (final && game.mode === 'live' && game.status === 'started' && game.createdBy === member.uid) markDone(game.id);

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
                {r.name} {r.exact > 0 && <small className="hint">🎯 {r.exact}</small>}
              </span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ol>
        <p className="hint">Exact = 10 plus up to 5 for speed. Within 5 = 7, within 10 = 5, within 25 = 2.</p>
      </div>

      {game.puzzles.map((p, i) => (
        <details key={i} className="card tq-review" open={game.puzzles.length === 1}>
          <summary>
            <span>
              Round {i + 1}: target <strong>{p.target}</strong> from {p.numbers.join(', ')}
            </span>
          </summary>
          {solutions[i] && (
            <p>
              {solutions[i]!.distance === 0 ? 'One way: ' : `Closest possible: `}
              <strong>
                {solutions[i]!.expression} = {solutions[i]!.value}
              </strong>
            </p>
          )}
          <ul className="nt-review">
            {done.map((pl) => {
              const r = roundResult(p, pl.words[i], game.perRound);
              return (
                <li key={pl.uid} className={r.distance === 0 ? 'right' : ''}>
                  <span className="who">{pl.name}</span>
                  <span>
                    {r.best} {r.distance === 0 ? '🎯' : <small className="hint">({r.distance} away)</small>}
                    {r.steps.length > 0 && (
                      <small className="nt-how">
                        {r.steps.map((s) => `${s.a} ${OP_SYMBOL[s.op]} ${s.b} = ${s.value}`).join(' · ')}
                      </small>
                    )}
                  </span>
                  <span className="pts">{r.points ? `+${r.points}` : '0'}</span>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}

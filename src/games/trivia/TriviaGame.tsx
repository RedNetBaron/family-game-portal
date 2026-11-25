import { useCallback, useEffect, useRef } from 'react';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { beginPlay, markDone, saveWords, submitPlay, type Play } from '../common/api';
import { CloseEarly, Countdown, Lobby, ms, TurnIntro, useGame, useMyPlay, usePlays, RecordResult } from '../common/Phases';
import type { TriviaGame as Game } from './api';
import { answerPoints, decodeAnswer, scoreTrivia } from './logic';
import { QuizRunner } from './QuizRunner';

export function TriviaGame({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<Game>(gameId);
  const myPlay = useMyPlay(gameId, member.uid);
  const now = useNow(500);

  if (game === undefined || myPlay === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;

  const endsAt = ms(game.endsAt);
  const startAt = ms(game.startAt);
  const submitted = !!myPlay?.submittedAt;
  const gameOver = endsAt !== null && now > endsAt;
  const n = game.questions.length;

  let body: React.ReactNode;
  if (game.mode === 'live') {
    const joined = !!game.players[member.uid];
    if (game.status === 'lobby') {
      body = <Lobby game={game} member={member} joined={joined} what={`${n} questions`} />;
    } else if (!joined) {
      body = gameOver ? (
        <Results game={game} member={member} />
      ) : (
        <p className="card">This round started without you. Results will show here when it ends.</p>
      );
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
          You'll get <strong>{n} questions</strong> with <strong>{game.perQuestion} seconds</strong> each. Faster right
          answers score more.
        </TurnIntro>
      );
    } else if (myDeadline !== null) {
      body = <PlayRound game={game} member={member} play={myPlay} deadline={myDeadline} />;
    }
  }

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/trivia" className="link">‹ Family Trivia</a>
        <h2>{game.mode === 'live' ? 'Live game' : 'Take turns'}</h2>
        <span className="badge">
          {n} Qs · {game.perQuestion}s
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

  const onAnswer = useCallback(
    (answers: string[]) => {
      saveWords(game.id, member.uid, answers).catch(() => undefined);
    },
    [game.id, member.uid],
  );
  const onFinish = useCallback(
    (answers: string[]) => {
      submitPlay(game.id, member.uid, answers).catch(() => undefined);
    },
    [game.id, member.uid],
  );

  if (!play) return <p className="center">Starting…</p>;
  return (
    <QuizRunner
      questions={game.questions}
      perQuestion={game.perQuestion}
      deadline={deadline}
      initial={play.words}
      onAnswer={onAnswer}
      onFinish={onFinish}
    />
  );
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
  const standings = scoreTrivia(
    game.questions,
    game.perQuestion,
    done.map((p) => ({ uid: p.uid, name: p.name, answers: p.words })),
  );

  const record = <RecordResult game={game} over={final} rows={standings.map((r) => ({ uid: r.uid, name: r.name, score: r.score }))} />;

  if (final && game.mode === 'live' && game.status === 'started' && game.createdBy === member.uid) {
    markDone(game.id);
  }

  return (
    <div className="lg-results">
      {record}
      <div className="card">
        <h3>{final ? 'Final results' : 'Standings so far'}</h3>
        {!final && (
          <p className="hint">
            {waiting.length ? `Still playing: ${waiting.join(', ')}. ` : ''}
            {game.mode === 'turns' && endsAt
              ? `Others can play until ${new Date(endsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`
              : ''}
          </p>
        )}
        <CloseEarly game={game} member={member} />
        <ol className="lg-standings">
          {standings.map((r, i) => (
            <li key={r.uid} className={r.uid === member.uid ? 'me' : ''}>
              <span className="place">{final && i === 0 && r.score > 0 ? '🏆' : `${i + 1}.`}</span>
              <span className="who">
                {r.name} <small className="hint">{r.correct}/{game.questions.length} right</small>
              </span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ol>
        <p className="hint">100 points per right answer, plus up to 50 for answering fast.</p>
      </div>

      {game.questions.map((q, i) => (
        <details key={i} className="card tq-review">
          <summary>
            <span>
              {i + 1}. {q.question}
            </span>
          </summary>
          <p>
            Answer: <strong>{q.choices[q.answer]}</strong>
          </p>
          <ul>
            {done.map((p) => {
              const a = decodeAnswer(p.words[i]);
              const pts = answerPoints(q, a, game.perQuestion);
              return (
                <li key={p.uid} className={pts ? 'right' : 'wrong'}>
                  <span className="who">{p.name}</span>
                  <span>{a && a.choice >= 0 ? q.choices[a.choice] : 'No answer'}</span>
                  <span className="pts">{pts ? `+${pts}` : '0'}</span>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}

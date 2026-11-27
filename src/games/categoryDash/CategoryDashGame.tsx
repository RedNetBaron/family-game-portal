import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { beginPlay, markDone, saveWords, submitPlay, type Play } from '../common/api';
import { CloseEarly, Countdown, Lobby, ms, TurnIntro, useGame, useMyPlay, usePlays, RecordResult } from '../common/Phases';
import { formatDuration } from '../letterGrid/logic';
import { saveMyVotes, useVotes, type CategoryGame } from './api';
import { AnswerSheet } from './AnswerSheet';
import { scoreGame, type AnswerStatus } from './logic';

export function CategoryDashGame({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<CategoryGame>(gameId);
  const myPlay = useMyPlay(gameId, member.uid);
  const now = useNow(500);

  if (game === undefined || myPlay === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;

  const endsAt = ms(game.endsAt);
  const startAt = ms(game.startAt);
  const submitted = !!myPlay?.submittedAt;
  const gameOver = endsAt !== null && now > endsAt;
  const n = game.categories.length;

  let body: React.ReactNode;
  if (game.mode === 'live') {
    const joined = !!game.players[member.uid];
    if (game.status === 'lobby') {
      body = <Lobby game={game} member={member} joined={joined} what={`letter and ${n} categories`} />;
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
          You get <strong>{formatDuration(game.seconds)}</strong> to fill in {n} categories, all starting with the same
          letter. The letter is revealed when you start.
        </TurnIntro>
      );
    } else if (myDeadline !== null) {
      body = <PlayRound game={game} member={member} play={myPlay} deadline={myDeadline} />;
    }
  }

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/category-dash" className="link">‹ Category Dash</a>
        <h2>{game.mode === 'live' ? 'Live game' : 'Take turns'}</h2>
        <span className="badge">
          {n} · {formatDuration(game.seconds)}
        </span>
      </header>
      {body}
    </section>
  );
}

function PlayRound({ game, member, play, deadline }: {
  game: CategoryGame; member: Member; play: Play | null; deadline: number;
}) {
  const started = useRef(false);
  useEffect(() => {
    if (!play && !started.current) {
      started.current = true;
      beginPlay(game, member).catch(() => undefined);
    }
  }, [play, game, member]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChange = useCallback(
    (answers: string[]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveWords(game.id, member.uid, answers).catch(() => undefined), 800);
    },
    [game.id, member.uid],
  );
  const onFinish = useCallback(
    (answers: string[]) => {
      clearTimeout(saveTimer.current);
      submitPlay(game.id, member.uid, answers).catch(() => undefined);
    },
    [game.id, member.uid],
  );

  if (!play) return <p className="center">Starting…</p>;
  return (
    <AnswerSheet
      letter={game.letter}
      categories={game.categories}
      deadline={deadline}
      initial={play.words}
      onChange={onChange}
      onFinish={onFinish}
    />
  );
}

const STATUS_LABEL: Record<AnswerStatus, string> = {
  ok: '+1',
  blank: '',
  'wrong-letter': `wrong letter`,
  duplicate: 'match',
  rejected: 'voted out',
};

function Results({ game, member }: { game: CategoryGame; member: Member }) {
  const plays = usePlays(game.id);
  const votes = useVotes(game.id, plays !== null);
  const now = useNow(1000);
  const [myRejects, setMyRejects] = useState<Record<string, boolean> | null>(null);

  const mine = myRejects ?? votes[member.uid] ?? {};
  const allVotes = useMemo(() => ({ ...votes, [member.uid]: mine }), [votes, member.uid, mine]);

  if (!plays) return <p className="center">Loading results…</p>;

  const done = plays.filter((p) => p.submittedAt);
  const endsAt = ms(game.endsAt);
  const over = endsAt !== null && now > endsAt + (game.mode === 'live' ? 5000 : 0);
  const waiting = Object.entries(game.players)
    .filter(([uid]) => !done.some((p) => p.uid === uid))
    .map(([, name]) => name);
  const final = over || (game.mode === 'live' && waiting.length === 0);
  const { byCategory, standings } = scoreGame(
    game.letter,
    game.categories.length,
    done.map((p) => ({ uid: p.uid, name: p.name, answers: p.words })),
    allVotes,
  );

  const record = <RecordResult game={game} over={final} rows={standings.map((r) => ({ uid: r.uid, name: r.name, score: r.score }))} />;

  if (final && game.mode === 'live' && game.status === 'started' && game.createdBy === member.uid) {
    markDone(game.id);
  }

  function toggle(key: string) {
    const next = { ...mine };
    if (next[key]) delete next[key];
    else next[key] = true;
    setMyRejects(next);
    saveMyVotes(game.id, member.uid, next).catch(() => setMyRejects(null));
  }

  const others = Math.max(0, done.length - 1);

  return (
    <div className="lg-results">
      {record}
      <div className="card">
        <div className="cd-result-head">
          <div className="cd-letter small">{game.letter}</div>
          <h3>{final ? 'Final results' : 'Standings so far'}</h3>
        </div>
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
              <span className="who">{r.name}</span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ol>
      </div>

      {others > 0 && (
        <p className="hint">
          Think an answer doesn't fit its category? Tap 👎 on it. If most of the other players agree, it scores 0.
          Two-word answers where both words start with the letter score 2.
          Crossed-out “match” answers were given by more than one person.
        </p>
      )}

      {game.categories.map((cat, c) => (
        <div key={c} className="card cd-cat">
          <h4>
            {c + 1}. {cat}
          </h4>
          <ul>
            {byCategory[c].map((a) => {
              const key = `${c}|${a.uid}`;
              const canVote = a.uid !== member.uid && a.status !== 'blank' && a.status !== 'wrong-letter';
              return (
                <li key={a.uid} className={`cd-answer ${a.status}`}>
                  <span className="who">{a.name}</span>
                  <span className="ans">{a.answer || '—'}</span>
                  <span className="pts">{a.status === 'ok' ? `+${a.points}` : STATUS_LABEL[a.status]}</span>
                  {canVote && (
                    <button
                      className={mine[key] ? 'vote on' : 'vote'}
                      aria-pressed={!!mine[key]}
                      aria-label={`Reject ${a.name}'s answer`}
                      onClick={() => toggle(key)}
                    >
                      👎{a.rejectVotes ? ` ${a.rejectVotes}/${others}` : ''}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

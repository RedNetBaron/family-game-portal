import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { CloseEarly, Countdown, Lobby, ms, TurnIntro, useGame, useMyPlay, usePlays, RecordResult } from '../common/Phases';
import { beginPlay, markDone, saveWords, submitPlay, type Game, type Play } from './api';
import { Board } from './Board';
import { formatDuration, scoreRound, sizeOf, solve, wordPoints } from './logic';
import { loadDictionary, type Dictionary } from './words';


export function LetterGridGame({ gameId, member }: { gameId: string; member: Member }) {
  const game = useGame<Game>(gameId);
  const myPlay = useMyPlay(gameId, member.uid);
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState('');
  const now = useNow(500);

  useEffect(() => {
    loadDictionary().then(setDict, () => setError("Couldn't load the word list. Check your connection."));
  }, []);

  if (game === undefined || myPlay === undefined) return <p className="center">Loading game…</p>;
  if (game === null) return <p className="center">This game doesn't exist anymore.</p>;

  const endsAt = ms(game.endsAt);
  const startAt = ms(game.startAt);
  const submitted = !!myPlay?.submittedAt;
  const gameOver = endsAt !== null && now > endsAt;

  let body: React.ReactNode;

  if (game.mode === 'live') {
    const joined = !!game.players[member.uid];
    if (game.status === 'lobby') {
      body = <Lobby game={game} member={member} joined={joined} what="letters" />;
    } else if (!joined) {
      body = gameOver ? (
        <Results game={game} member={member} dict={dict} />
      ) : (
        <p className="card">This round started without you. Results will show here when it ends.</p>
      );
    } else if (startAt !== null && now < startAt) {
      body = <Countdown seconds={Math.ceil((startAt - now) / 1000)} />;
    } else if (!submitted && endsAt !== null && now < endsAt + 5000) {
      body = dict ? (
        <PlayRound game={game} member={member} dict={dict} play={myPlay} deadline={endsAt} />
      ) : (
        <p className="center">Loading words…</p>
      );
    } else {
      body = <Results game={game} member={member} dict={dict} />;
    }
  } else {
    const myDeadline = myPlay?.startedAt ? ms(myPlay.startedAt)! + game.seconds * 1000 : null;
    if (submitted || gameOver) {
      body = <Results game={game} member={member} dict={dict} />;
    } else if (!myPlay) {
      body = (
        <TurnIntro game={game} member={member}>
          You get <strong>{formatDuration(game.seconds)}</strong> on a {sizeOf(game.grid)}×{sizeOf(game.grid)} board to
          find as many words as you can.
        </TurnIntro>
      );
    } else if (myDeadline !== null && dict) {
      body = <PlayRound game={game} member={member} dict={dict} play={myPlay} deadline={myDeadline} />;
    } else {
      body = <p className="center">Loading words…</p>;
    }
  }

  return (
    <section className="lg">
      <header className="lg-head">
        <a href="#/games/letter-grid" className="link">‹ Letter Grid</a>
        <h2>{game.mode === 'live' ? 'Live game' : 'Take turns'}</h2>
        <span className="badge">
          {sizeOf(game.grid)}×{sizeOf(game.grid)} · {formatDuration(game.seconds)}
        </span>
      </header>
      {error && <p className="error">{error}</p>}
      {body}
    </section>
  );
}

function PlayRound({ game, member, dict, play, deadline }: {
  game: Game; member: Member; dict: Dictionary; play: Play | null; deadline: number;
}) {
  const started = useRef(false);
  useEffect(() => {
    // Live games: create the play record when the round begins.
    if (!play && !started.current) {
      started.current = true;
      beginPlay(game, member).catch(() => undefined);
    }
  }, [play, game, member]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onWordsChange = useCallback(
    (words: string[]) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveWords(game.id, member.uid, words).catch(() => undefined), 800);
    },
    [game.id, member.uid],
  );
  const onFinish = useCallback(
    (words: string[]) => {
      clearTimeout(saveTimer.current);
      submitPlay(game.id, member.uid, words).catch(() => undefined);
    },
    [game.id, member.uid],
  );

  if (!play) return <p className="center">Starting…</p>;
  return (
    <Board
      grid={game.grid}
      deadline={deadline}
      dict={dict}
      initialWords={play.words}
      onWordsChange={onWordsChange}
      onFinish={onFinish}
    />
  );
}

function Results({ game, member, dict }: { game: Game; member: Member; dict: Dictionary | null }) {
  const plays = usePlays(game.id);
  const [showAll, setShowAll] = useState(false);
  const now = useNow(1000);

  const possible = useMemo(() => (dict ? solve(game.grid, dict.words, dict.prefixes) : []), [dict, game.grid]);

  if (!plays) return <p className="center">Loading results…</p>;

  const done = plays.filter((p) => p.submittedAt);
  const endsAt = ms(game.endsAt);
  const over = endsAt !== null && now > endsAt + (game.mode === 'live' ? 5000 : 0);
  const waiting = Object.entries(game.players)
    .filter(([uid]) => !done.some((p) => p.uid === uid))
    .map(([, name]) => name);
  const final = over || (game.mode === 'live' && waiting.length === 0);
  const results = scoreRound(done);
  const foundByAnyone = new Set(done.flatMap((p) => p.words));
  const missed = possible.filter((w) => !foundByAnyone.has(w));

  // The host marks a finished live game as done so the games list shows it as finished.
  const record = <RecordResult game={game} over={final} rows={results.map((r) => ({ uid: r.uid, name: r.name, score: r.score }))} />;

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
              ? `Others can play until ${new Date(endsAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. Scores can change, because words more than one person finds don't count.`
              : ''}
          </p>
        )}
        <CloseEarly game={game} member={member} />
        <ol className="lg-standings">
          {results.map((r, i) => (
            <li key={r.uid} className={r.uid === member.uid ? 'me' : ''}>
              <span className="place">{final && i === 0 && r.score > 0 ? '🏆' : `${i + 1}.`}</span>
              <span className="who">{r.name}</span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ol>
      </div>

      {results.map((r) => (
        <details key={r.uid} className="card lg-words" open={r.uid === member.uid}>
          <summary>
            {r.name}: {r.words.length} words
          </summary>
          <ul>
            {r.words.map((w) => (
              <li key={w.word} className={w.shared ? 'shared' : ''} title={w.shared ? 'Someone else found this too' : ''}>
                {w.word} <small>{w.shared ? '0' : `+${w.points}`}</small>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="hint">Crossed-out words were found by more than one person and score 0.</p>

      {final && missed.length > 0 && (
        <div className="card lg-words">
          <h3>Words nobody found</h3>
          <p className="hint">{possible.length} words were possible on this board.</p>
          <ul>
            {(showAll ? missed : missed.slice(0, 15)).map((w) => (
              <li key={w}>
                {w} <small>+{wordPoints(w)}</small>
              </li>
            ))}
          </ul>
          {missed.length > 15 && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${missed.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

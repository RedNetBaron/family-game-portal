import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../lib/firebase';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { beginPlay, joinLobby, markDone, saveWords, startLiveGame, submitPlay, type Game, type Play } from './api';
import { Board } from './Board';
import { formatDuration, scoreRound, sizeOf, solve, wordPoints } from './logic';
import { loadDictionary, type Dictionary } from './words';

const ms = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : null);

export function LetterGridGame({ gameId, member }: { gameId: string; member: Member }) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [myPlay, setMyPlay] = useState<Play | null | undefined>(undefined);
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState('');
  const now = useNow(500);

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'games', gameId),
        (snap) => setGame(snap.exists() ? ({ id: snap.id, ...snap.data() } as Game) : null),
        () => setGame(null),
      ),
    [gameId],
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'games', gameId, 'plays', member.uid),
        (snap) => {
          if (snap.metadata.hasPendingWrites && !snap.exists()) return;
          setMyPlay(snap.exists() ? (snap.data({ serverTimestamps: 'estimate' }) as Play) : null);
        },
        () => setMyPlay(null),
      ),
    [gameId, member.uid],
  );

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
      body = <Lobby game={game} member={member} joined={joined} />;
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
      body = <TurnIntro game={game} member={member} />;
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

function Lobby({ game, member, joined }: { game: Game; member: Member; joined: boolean }) {
  const [busy, setBusy] = useState(false);
  const isHost = game.createdBy === member.uid;
  const names = Object.values(game.players);
  return (
    <div className="card lg-lobby">
      <h3>Waiting for players</h3>
      <p className="hint">
        {isHost
          ? `When everyone is in, press Start. Everyone gets the same letters and ${formatDuration(game.seconds)}.`
          : `${game.createdByName} will start the round when everyone is in.`}
      </p>
      <ul className="lg-players">
        {names.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {!joined && (
        <button className="primary" disabled={busy} onClick={() => { setBusy(true); joinLobby(game.id, member).finally(() => setBusy(false)); }}>
          Join this round
        </button>
      )}
      {isHost && (
        <button className="primary" disabled={busy} onClick={() => { setBusy(true); startLiveGame(game).finally(() => setBusy(false)); }}>
          Start ({names.length} {names.length === 1 ? 'player' : 'players'})
        </button>
      )}
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  return (
    <div className="lg-countdown">
      <p>Get ready…</p>
      <span>{seconds}</span>
    </div>
  );
}

function TurnIntro({ game, member }: { game: Game; member: Member }) {
  const [busy, setBusy] = useState(false);
  const played = Object.values(game.players);
  const hoursLeft = Math.max(0, Math.round((ms(game.endsAt)! - Date.now()) / 3600_000));
  return (
    <div className="card lg-lobby">
      <h3>Your turn</h3>
      <p>
        You get <strong>{formatDuration(game.seconds)}</strong> on a {sizeOf(game.grid)}×{sizeOf(game.grid)} board to find as many words as you can. Once you start, the clock keeps
        running, so make sure you have a few minutes free.
      </p>
      <p className="hint">
        {played.length ? `Already played: ${played.join(', ')}.` : 'Nobody has played yet.'} About {hoursLeft}{' '}
        {hoursLeft === 1 ? 'hour' : 'hours'} left to play.
      </p>
      <button className="primary" disabled={busy} onClick={() => { setBusy(true); beginPlay(game, member).catch(() => setBusy(false)); }}>
        Start my turn
      </button>
    </div>
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
  const [plays, setPlays] = useState<Play[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const now = useNow(1000);

  // Other players' words become readable once the server has our finished round,
  // which can be a moment after we press Done, so retry a few times if refused.
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      collection(db, 'games', game.id, 'plays'),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) setPlays(snap.docs.map((d) => d.data() as Play));
      },
      () => {
        if (attempt < 8) retry = setTimeout(() => setAttempt((a) => a + 1), 1000);
      },
    );
    return () => {
      stop();
      clearTimeout(retry);
    };
  }, [game.id, attempt]);

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
  if (final && game.mode === 'live' && game.status === 'started' && game.createdBy === member.uid) {
    markDone(game.id);
  }

  return (
    <div className="lg-results">
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

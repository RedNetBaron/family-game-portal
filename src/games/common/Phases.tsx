import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState, type ReactNode } from 'react';
import { db } from '../../lib/firebase';
import { useNow } from '../../lib/useNow';
import type { Member } from '../../lib/useMember';
import { formatDuration, MAX_SECONDS, MIN_SECONDS } from '../letterGrid/logic';
import { beginPlay, closeNow, joinLobby, startLiveGame, type BaseGame, type Mode, type Play } from './api';

export const ms = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : null);

/** Live game document. undefined while loading, null if missing. */
export function useGame<T extends BaseGame>(gameId: string): T | null | undefined {
  const [game, setGame] = useState<T | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'games', gameId),
        (snap) => setGame(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null),
        () => setGame(null),
      ),
    [gameId],
  );
  return game;
}

/** This member's play record. undefined while loading, null if they haven't started. */
export function useMyPlay(gameId: string, uid: string): Play | null | undefined {
  const [play, setPlay] = useState<Play | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'games', gameId, 'plays', uid),
        (snap) => {
          if (snap.metadata.hasPendingWrites && !snap.exists()) return;
          setPlay(snap.exists() ? (snap.data({ serverTimestamps: 'estimate' }) as Play) : null);
        },
        () => setPlay(null),
      ),
    [gameId, uid],
  );
  return play;
}

/**
 * Everyone's plays. Readable once your own round is in (or the game is over),
 * which can lag a moment behind pressing Done, so it retries if refused.
 */
export function usePlays(gameId: string): Play[] | null {
  const [plays, setPlays] = useState<Play[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const stop = onSnapshot(
      collection(db, 'games', gameId, 'plays'),
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
  }, [gameId, attempt]);
  return plays;
}

export function gameStatus(g: BaseGame, now: number, uid: string): { label: string; active: boolean } {
  const ends = ms(g.endsAt);
  if (g.mode === 'live') {
    if (g.status === 'lobby') return { label: 'Waiting for players', active: true };
    if (g.status === 'done') return { label: 'Finished', active: false };
    if (ends && now < ends) return { label: 'Playing now', active: true };
    return { label: 'Finished', active: false };
  }
  if (ends && now < ends) {
    const played = !!g.players[uid];
    const hrs = Math.max(1, Math.round((ends - now) / 3600_000));
    return { label: played ? `You played · ${hrs}h left for others` : `Your turn · ${hrs}h left`, active: !played };
  }
  return { label: 'Finished', active: false };
}

/** Recent games of one type, newest first. */
export function RecentGames<T extends BaseGame>({ type, member, describe }: {
  type: string;
  member: Member;
  describe: (g: T) => string;
}) {
  const [games, setGames] = useState<T[]>([]);
  const now = useNow(30_000);
  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, (snap) =>
      setGames(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as T)
          .filter((g) => g.type === type)
          .slice(0, 15),
      ),
    );
  }, [type]);
  if (!games.length) return null;
  return (
    <div className="card">
      <h3>Recent games</h3>
      <ul className="game-list">
        {games.map((g) => {
          const s = gameStatus(g, now, member.uid);
          return (
            <li key={g.id}>
              <a href={`#/game/${g.id}`}>
                <span>
                  {describe(g)} {g.mode === 'live' ? '(live)' : '(take turns)'}
                  <small> by {g.createdByName}</small>
                </span>
                <span className={s.active ? 'badge hot' : 'badge'}>{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Timer chips (presets plus custom). Calls onChange with seconds, or null if the custom time is invalid. */
export function TimerChoice({ presets, initial, onChange }: {
  presets: number[];
  initial: number;
  onChange: (seconds: number | null) => void;
}) {
  const [preset, setPreset] = useState<number | 'custom'>(initial);
  const [customMin, setCustomMin] = useState('2');
  const [customSec, setCustomSec] = useState('30');
  const custom = (parseInt(customMin, 10) || 0) * 60 + (parseInt(customSec, 10) || 0);
  const seconds = preset === 'custom' ? custom : preset;
  const ok = seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;
  useEffect(() => onChange(ok ? seconds : null), [ok, seconds, onChange]);
  return (
    <fieldset className="choice">
      <legend>Timer</legend>
      <div className="chips">
        {presets.map((t) => (
          <button key={t} type="button" className={preset === t ? 'chip on' : 'chip'} aria-pressed={preset === t} onClick={() => setPreset(t)}>
            {t / 60} min
          </button>
        ))}
        <button type="button" className={preset === 'custom' ? 'chip on' : 'chip'} aria-pressed={preset === 'custom'} onClick={() => setPreset('custom')}>
          Custom
        </button>
      </div>
      {preset === 'custom' && (
        <div className="custom-time">
          <label>
            <input inputMode="numeric" value={customMin} maxLength={2} onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, ''))} aria-label="Minutes" />
            min
          </label>
          <label>
            <input inputMode="numeric" value={customSec} maxLength={2} onChange={(e) => setCustomSec(e.target.value.replace(/\D/g, ''))} aria-label="Seconds" />
            sec
          </label>
          {!ok && <span className="error">Pick between 30 seconds and 15 minutes.</span>}
        </div>
      )}
    </fieldset>
  );
}

/** Live / Take turns buttons. */
export function ModeButtons({ disabled, busy, onStart }: {
  disabled: boolean;
  busy: Mode | null;
  onStart: (mode: Mode) => void;
}) {
  return (
    <div className="mode-buttons">
      <button className="primary" disabled={disabled || !!busy} onClick={() => onStart('live')}>
        {busy === 'live' ? 'Starting…' : 'Play live'}
      </button>
      <button className="primary alt" disabled={disabled || !!busy} onClick={() => onStart('turns')}>
        {busy === 'turns' ? 'Starting…' : 'Take turns'}
      </button>
    </div>
  );
}

/** For take-turns games: lets the creator end the game early once everyone who wants to has played. */
export function CloseEarly({ game, member }: { game: BaseGame; member: Member }) {
  const [busy, setBusy] = useState(false);
  if (game.mode !== 'turns' || game.createdBy !== member.uid) return null;
  return (
    <button
      className="link"
      disabled={busy}
      onClick={() => {
        let ok = true;
        try {
          ok = window.confirm('End this game for everyone now? Anyone who hasn\u2019t played will miss it.');
        } catch {
          /* no dialogs available */
        }
        if (ok) {
          setBusy(true);
          closeNow(game.id).finally(() => setBusy(false));
        }
      }}
    >
      Everyone's played? End the game now
    </button>
  );
}

export function Lobby({ game, member, joined, what }: { game: BaseGame; member: Member; joined: boolean; what: string }) {
  const [busy, setBusy] = useState(false);
  const isHost = game.createdBy === member.uid;
  const names = Object.values(game.players);
  return (
    <div className="card lg-lobby">
      <h3>Waiting for players</h3>
      <p className="hint">
        {isHost
          ? `When everyone is in, press Start. Everyone gets the same ${what} and ${formatDuration(game.seconds)}.`
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

export function Countdown({ seconds }: { seconds: number }) {
  return (
    <div className="lg-countdown">
      <p>Get ready…</p>
      <span>{seconds}</span>
    </div>
  );
}

export function TurnIntro({ game, member, children }: { game: BaseGame; member: Member; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const played = Object.values(game.players);
  const hoursLeft = Math.max(0, Math.round((ms(game.endsAt)! - Date.now()) / 3600_000));
  return (
    <div className="card lg-lobby">
      <h3>Your turn</h3>
      <p>
        {children} Once you start, the clock keeps running, so make sure you have a few minutes free.
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


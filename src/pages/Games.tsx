import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { createGame, type Game, type Mode } from '../games/letterGrid/api';
import { db } from '../lib/firebase';
import { useNow } from '../lib/useNow';
import type { Member } from '../lib/useMember';

const upcoming = [
  { name: 'Category Dash', blurb: 'One letter, a list of categories. Fill them in fast.' },
  { name: 'Family Trivia', blurb: 'Multiple-choice questions with a family scoreboard.' },
];

function gameStatus(g: Game, now: number, uid: string): { label: string; active: boolean } {
  const ends = g.endsAt?.toMillis() ?? null;
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

export function Games({ member }: { member: Member }) {
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const now = useNow(30_000);

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) =>
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as Game)),
    );
  }, []);

  async function start(mode: Mode) {
    setBusy(mode);
    setError('');
    try {
      const id = await createGame(member, mode);
      location.hash = `#/game/${id}`;
    } catch {
      setError("Couldn't start a game. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="games">
      <article className="card game">
        <h3>Letter Grid</h3>
        <p>Find words in a grid of letters before the 3 minutes run out. Longer words score more, and words someone else also found don't count.</p>
        <div className="mode-buttons">
          <button className="primary" disabled={!!busy} onClick={() => start('live')}>
            {busy === 'live' ? 'Starting…' : 'Play live'}
          </button>
          <button className="primary alt" disabled={!!busy} onClick={() => start('turns')}>
            {busy === 'turns' ? 'Starting…' : 'Take turns'}
          </button>
        </div>
        <p className="hint">
          <strong>Live:</strong> everyone plays the same 3 minutes together. <strong>Take turns:</strong> everyone plays
          the same letters whenever they like over the next 24 hours.
        </p>
        {error && <p className="error">{error}</p>}
      </article>

      {games.length > 0 && (
        <div className="card">
          <h3>Recent games</h3>
          <ul className="game-list">
            {games.map((g) => {
              const s = gameStatus(g, now, member.uid);
              return (
                <li key={g.id}>
                  <a href={`#/game/${g.id}`}>
                    <span>
                      Letter Grid {g.mode === 'live' ? '(live)' : '(take turns)'}
                      <small> by {g.createdByName}</small>
                    </span>
                    <span className={s.active ? 'badge hot' : 'badge'}>{s.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {upcoming.map((g) => (
        <article key={g.name} className="card game">
          <h3>{g.name}</h3>
          <p>{g.blurb}</p>
          <span className="badge">Coming soon</span>
        </article>
      ))}
    </section>
  );
}

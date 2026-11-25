import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { deleteField, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Member } from '../lib/useMember';
import { useChampions } from './Scores';
import { EVERYONE, findMentions, insertMention, mentionQuery, splitMentions, suggestions, type Person } from '../lib/mentions';

type Message = {
  id: string;
  uid: string;
  name: string;
  text: string;
  gameId?: string;
  mentions?: string[];
  reactions?: Record<string, string>;
  createdAt: Timestamp | null;
};

function timeLabel(ts: Timestamp | null): string {
  if (!ts) return 'sending…';
  const d = ts.toDate();
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function Chat({ member }: { member: Member }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const champ = useChampions()[0];
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'members'),
        (snap) => setPeople(snap.docs.map((d) => ({ uid: d.id, name: d.get('name') as string })).filter((p) => p.name)),
        () => undefined,
      ),
    [],
  );

  const [picker, setPicker] = useState<string | null>(null);

  function react(m: Message, emoji: string) {
    setPicker(null);
    const current = m.reactions?.[member.uid];
    updateDoc(doc(db, 'messages', m.id), {
      [`reactions.${member.uid}`]: current === emoji ? deleteField() : emoji,
    }).catch(() => setError("Couldn't add your reaction. Try again."));
  }

  const q = mentionQuery(text);
  const picks = q === null ? [] : suggestions(people, q, member.uid);

  function pick(name: string) {
    setText((t) => insertMention(t, name));
    input.current?.focus();
  }

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt'), limitToLast(200));
    return onSnapshot(
      q,
      (snap) =>
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Message, 'id'>),
          })),
        ),
      () => setError("Couldn't load the chat. Check your connection."),
    );
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const mentions = findMentions(body, people).filter((u) => u !== member.uid);
      await addDoc(collection(db, 'messages'), {
        uid: member.uid,
        name: member.name,
        text: body.slice(0, 1000),
        ...(mentions.length ? { mentions } : {}),
        createdAt: serverTimestamp(),
      });
      setError('');
    } catch {
      setText(body);
      setError("Your message didn't send. Try again.");
    }
  }

  return (
    <section className="chat">
      <ol className="messages">
        {messages.length === 0 && <li className="empty">No messages yet. Say hi!</li>}
        {messages.map((m) => {
          const mine = m.uid === member.uid;
          const tagged = !mine && !!m.mentions && (m.mentions.includes(member.uid) || m.mentions.includes(EVERYONE));
          return (
            <li key={m.id} className={`msg${mine ? ' mine' : ''}${tagged ? ' tagged' : ''}`}>
              {!mine && <span className="who">{m.name}{champ?.uid === m.uid ? ' 🏆' : ''}</span>}
              {m.gameId ? (
                <span className="bubble game-bubble">
                  🎲 {mine ? 'You' : m.name} {m.text}
                  <a className="primary small" href={`#/game/${m.gameId}`}>Open game</a>
                </span>
              ) : (
                <span
                  className="bubble"
                  role="button"
                  tabIndex={0}
                  aria-label="React to this message"
                  onClick={() => setPicker(picker === m.id ? null : m.id)}
                >
                  {splitMentions(m.text, people).map((part, i) =>
                    part.uid ? (
                      <span key={i} className={part.uid === member.uid || part.uid === EVERYONE ? 'mention me' : 'mention'}>
                        {part.text}
                      </span>
                    ) : (
                      part.text
                    ),
                  )}
                </span>
              )}
              {picker === m.id && (
                <span className="react-bar" role="toolbar" aria-label="Reactions">
                  {REACTIONS.map((e) => (
                    <button key={e} className={m.reactions?.[member.uid] === e ? 'on' : ''} onClick={() => react(m, e)} aria-label={`React ${e}`}>
                      {e}
                    </button>
                  ))}
                </span>
              )}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <span className="reactions">
                  {summarize(m.reactions, people).map((r) => (
                    <button
                      key={r.emoji}
                      className={r.mine(member.uid) ? 'chip-react on' : 'chip-react'}
                      onClick={() => react(m, r.emoji)}
                      title={r.names.join(', ')}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                </span>
              )}
              <span className="meta">
                {timeLabel(m.createdAt)}
                {mine && (
                  <button
                    className="link small"
                    onClick={() => deleteDoc(doc(db, 'messages', m.id))}
                    aria-label="Delete message"
                  >
                    Delete
                  </button>
                )}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>
      {error && <p className="error" role="alert">{error}</p>}
      {picks.length > 0 && (
        <ul className="mention-picks" role="listbox" aria-label="Tag someone">
          {picks.map((p) => (
            <li key={p.uid}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p.name)}>
                @{p.name}
                {p.uid === EVERYONE && <small className="hint"> notify the whole family</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="composer" onSubmit={send}>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message (type @ to tag)"
          maxLength={1000}
          enterKeyHint="send"
        />
        <button className="primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>
  );
}

const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🎉'];

function summarize(reactions: Record<string, string>, people: Person[]) {
  const by = new Map<string, string[]>();
  for (const [uid, emoji] of Object.entries(reactions)) {
    if (!by.has(emoji)) by.set(emoji, []);
    by.get(emoji)!.push(uid);
  }
  return REACTIONS.filter((e) => by.has(e)).map((emoji) => {
    const uids = by.get(emoji)!;
    return {
      emoji,
      count: uids.length,
      names: uids.map((u) => people.find((p) => p.uid === u)?.name ?? 'Someone'),
      mine: (me: string) => uids.includes(me),
    };
  });
}

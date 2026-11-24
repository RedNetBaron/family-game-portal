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
import { db } from '../lib/firebase';
import type { Member } from '../lib/useMember';

type Message = { id: string; uid: string; name: string; text: string; createdAt: Timestamp | null };

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
  const bottom = useRef<HTMLDivElement>(null);

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
      await addDoc(collection(db, 'messages'), {
        uid: member.uid,
        name: member.name,
        text: body.slice(0, 1000),
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
          return (
            <li key={m.id} className={mine ? 'msg mine' : 'msg'}>
              {!mine && <span className="who">{m.name}</span>}
              <span className="bubble">{m.text}</span>
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
      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the family"
          maxLength={1000}
          enterKeyHint="send"
        />
        <button className="primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>
  );
}

import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Member } from '../lib/useMember';

/** Full logo plus a way to share the family invite link. */
export function LogoSheet({ member, onClose }: { member: Member; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    // Each member doc records the invite code they joined with; reuse it.
    getDoc(doc(db, 'members', member.uid))
      .then((snap) => {
        const code = snap.get('invite');
        setLink(code ? `${location.origin}/#/join/${code}` : `${location.origin}/`);
      })
      .catch(() => setLink(`${location.origin}/`));
  }, [member.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function share() {
    if (!link) return;
    const text = 'Join our family games! Open this link, type your first name and pick a password.';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Family Games', text, url: link });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copy();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied!');
    } catch {
      setStatus('Press and hold the link above to copy it.');
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet card" role="dialog" aria-modal="true" aria-label="Family Games" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close link" onClick={onClose} aria-label="Close">✕</button>
        <img src="/logo.png" alt="Game Master Red" className="sheet-logo" />
        <h3>Invite family</h3>
        <p className="hint">Send this link to family members so they can join.</p>
        <p className="sheet-link">{link ?? 'Loading…'}</p>
        <div className="mode-buttons">
          <button className="primary" onClick={share} disabled={!link}>
            Share invite link
          </button>
          <button className="primary alt" onClick={copy} disabled={!link}>
            Copy link
          </button>
        </div>
        {status && <p className="hint center-text">{status}</p>}
        <p className="hint center-text">Please share it only with family.</p>
      </div>
    </div>
  );
}

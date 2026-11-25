import { useEffect, useRef, useState } from 'react';
import { findPath, isAdjacent, MIN_WORD, pathToWord, wordPoints } from './logic';
import type { Dictionary } from './words';

type Props = {
  grid: string[];
  deadline: number; // ms
  dict: Dictionary;
  initialWords: string[];
  onWordsChange: (words: string[]) => void;
  onFinish: (words: string[]) => void;
};

type Flash = { text: string; kind: 'good' | 'bad' } | null;

export function Board({ grid, deadline, dict, initialWords, onWordsChange, onFinish }: Props) {
  const [words, setWords] = useState<string[]>(initialWords);
  const [path, setPath] = useState<number[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [typed, setTyped] = useState('');
  const [now, setNow] = useState(Date.now());
  const dragging = useRef(false);
  const moved = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const wordsRef = useRef(words);
  wordsRef.current = words;

  const left = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0 && !finished.current) {
      finished.current = true;
      onFinish(wordsRef.current);
    }
  }, [left, onFinish]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [flash]);

  function tryWord(raw: string) {
    const word = raw.toLowerCase().trim();
    if (!word) return;
    if (word.length < MIN_WORD) return setFlash({ text: 'Too short', kind: 'bad' });
    if (wordsRef.current.includes(word)) return setFlash({ text: 'Already found', kind: 'bad' });
    if (!findPath(grid, word)) return setFlash({ text: "Not on the board", kind: 'bad' });
    if (!dict.words.has(word)) return setFlash({ text: 'Not in the word list', kind: 'bad' });
    const next = [word, ...wordsRef.current];
    wordsRef.current = next;
    setWords(next);
    onWordsChange(next);
    const pts = wordPoints(word);
    setFlash({ text: `${word.toUpperCase()}  +${pts}`, kind: 'good' });
  }

  function tileAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const tile = el?.closest<HTMLElement>('[data-tile]');
    if (!tile) return null;
    // Only count the middle of a tile, so diagonal swipes don't clip a neighbour.
    const r = tile.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) > r.width * 0.42) return null;
    return Number(tile.dataset.tile);
  }

  const pathRef = useRef<number[]>([]);
  function updatePath(next: number[]) {
    pathRef.current = next;
    setPath(next);
  }

  function extend(i: number) {
    const p = pathRef.current;
    if (p.length && p[p.length - 1] === i) return;
    // Sliding back onto the previous tile undoes the last step.
    if (p.length >= 2 && p[p.length - 2] === i) return updatePath(p.slice(0, -1));
    if (p.includes(i)) return;
    if (p.length && !isAdjacent(p[p.length - 1], i)) return;
    moved.current = true;
    updatePath([...p, i]);
  }

  function onPointerDown(e: React.PointerEvent) {
    const i = tileAt(e.clientX, e.clientY);
    if (i === null) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragging.current = true;
    moved.current = false;
    const p = pathRef.current;
    // Tap mode: tapping the last tile again submits; tapping an adjacent tile extends.
    if (p.length && p[p.length - 1] === i) {
      tryWord(pathToWord(grid, p));
      updatePath([]);
      dragging.current = false;
    } else if (p.length && isAdjacent(p[p.length - 1], i) && !p.includes(i)) {
      updatePath([...p, i]);
    } else {
      updatePath([i]);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const i = tileAt(e.clientX, e.clientY);
    if (i !== null) extend(i);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (moved.current) {
      tryWord(pathToWord(grid, pathRef.current));
      updatePath([]);
    }
  }

  const current = pathToWord(grid, path).toUpperCase();
  const score = words.reduce((s, w) => s + wordPoints(w), 0);

  return (
    <section className="lg-board">
      <div className="lg-status">
        <span className={left <= 15 ? 'lg-timer urgent' : 'lg-timer'}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
        <span className="lg-score">{words.length} words · {score} pts</span>
      </div>

      <div className={`lg-current ${flash ? flash.kind : ''}`} aria-live="polite">
        {flash ? flash.text : current || ' '}
      </div>

      <div
        ref={boardRef}
        className="lg-grid"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {grid.map((letter, i) => (
          <div
            key={i}
            data-tile={i}
            className={
              'lg-tile' +
              (path.includes(i) ? ' on' : '') +
              (path[path.length - 1] === i ? ' last' : '')
            }
          >
            {letter === 'QU' ? 'Qu' : letter}
          </div>
        ))}
      </div>

      <div className="lg-actions">
        <button className="link" onClick={() => updatePath([])} disabled={!path.length}>
          Clear
        </button>
        <button
          className="primary"
          disabled={path.length < 2}
          onClick={() => {
            tryWord(pathToWord(grid, path));
            updatePath([]);
          }}
        >
          Enter
        </button>
      </div>

      <form
        className="lg-type"
        onSubmit={(e) => {
          e.preventDefault();
          tryWord(typed);
          setTyped('');
        }}
      >
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^a-zA-Z]/g, ''))}
          placeholder="Or type a word"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
      </form>

      <p className="hint">Swipe across letters, or tap them one by one and tap the last letter again.</p>

      <ul className="lg-found">
        {words.map((w) => (
          <li key={w}>
            {w} <small>+{wordPoints(w)}</small>
          </li>
        ))}
      </ul>

      <button
        className="link"
        onClick={() => {
          if (confirmFinish()) {
            finished.current = true;
            onFinish(wordsRef.current);
          }
        }}
      >
        I'm done, end my round early
      </button>
    </section>
  );
}

function confirmFinish(): boolean {
  try {
    return window.confirm('End your round now? You won’t be able to add more words.');
  } catch {
    return true;
  }
}

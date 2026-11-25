import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dueForReminder, newGameMessage, recipients, reminderMessage } from './notify.js';

test('live game message', () => {
  const m = newGameMessage('g1', { type: 'trivia', mode: 'live', createdByName: 'Anna' });
  assert.equal(m.title, 'Anna started a live Family Trivia');
  assert.equal(m.link, '/#/game/g1');
});

test('turns game message', () => {
  const m = newGameMessage('g2', { type: 'categoryDash', mode: 'turns', createdByName: 'Ben' });
  assert.equal(m.title, 'Your turn: Category Dash');
  assert.match(m.body, /Ben started a game/);
});

test('reminder message', () => {
  assert.match(reminderMessage('g', { type: 'letterGrid', createdByName: 'Cal' }, 3).body, /about 3 hours/);
});

test('recipients skip creator and players', () => {
  const tokens = [
    { token: 'a1', uid: 'a' },
    { token: 'a2', uid: 'a' },
    { token: 'b1', uid: 'b' },
    { token: 'c1', uid: 'c' },
  ];
  assert.deepEqual(recipients(tokens, new Set(['a'])), ['b1', 'c1']);
  assert.deepEqual(recipients(tokens, { b: 'Ben', c: 'Cal' }), ['a1', 'a2']);
});

test('reminder window', () => {
  const now = 0;
  const h = 3600_000;
  assert.equal(dueForReminder({ mode: 'turns', endsAtMs: 3 * h + 10 }, now, h), true);
  assert.equal(dueForReminder({ mode: 'turns', endsAtMs: 4 * h }, now, h), false);
  assert.equal(dueForReminder({ mode: 'turns', endsAtMs: 2 * h }, now, h), false);
  assert.equal(dueForReminder({ mode: 'live', endsAtMs: 3 * h + 10 }, now, h), false);
});

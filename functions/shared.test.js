import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markGuess } from './shared/dailyword.js';
import { dailyWordPoints, familyDay, placements, previousDay, previousMonth, standings } from './shared/scoring.js';

test('markGuess basics and repeated letters', () => {
  assert.equal(markGuess('crane', 'crane'), 'ccccc');
  assert.equal(markGuess('nacre', 'crane'), 'ppppc');
  assert.equal(markGuess('speed', 'abide'), 'aapap');
  assert.equal(markGuess('lolly', 'hello'), 'apcca');
  assert.equal(markGuess('allee', 'apple'), 'cpaac');
});

test('placements with ties and solo games', () => {
  const p = placements([{ uid: 'a', name: 'A', score: 10 }, { uid: 'b', name: 'B', score: 10 }, { uid: 'c', name: 'C', score: 3 }, { uid: 'd', name: 'D', score: 1 }]);
  assert.deepEqual([p.a.place, p.b.place, p.c.place, p.d.place], [1, 1, 3, 4]);
  assert.deepEqual([p.a.points, p.b.points, p.c.points, p.d.points], [5, 5, 2, 1]);
  assert.equal(placements([{ uid: 'a', name: 'A', score: 99 }]).a.points, 1);
});

test('daily word points', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => dailyWordPoints(true, n)), [5, 5, 4, 3, 2, 2]);
  assert.equal(dailyWordPoints(false, 6), 1);
});

test('dates in family time zone', () => {
  assert.equal(familyDay(Date.UTC(2026, 10, 25, 4, 0)), '2026-11-24'); // 10 PM Central
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousMonth('2026-01'), '2025-12');
});

test('standings cap best 3 games per day and add daily word', () => {
  const g = (day, pts) => ({ type: 'trivia', day, placements: { a: { name: 'Anna', place: 1, score: 1, points: pts } } });
  const results = [g('d1', 5), g('d1', 5), g('d1', 5), g('d1', 5), g('d2', 3)];
  const daily = [{ uid: 'a', name: 'Anna', day: 'd1', points: 4, solved: true }, { uid: 'b', name: 'Ben', day: 'd1', points: 5, solved: true }];
  const all = standings(results, daily);
  assert.equal(all[0].uid, 'a');
  assert.equal(all[0].points, 15 + 3 + 4);
  assert.equal(all[1].points, 5);
  assert.equal(standings(results, daily, 'dailyWord')[0].uid, 'b');
  assert.equal(standings(results, daily, 'letterGrid').length, 0);
});

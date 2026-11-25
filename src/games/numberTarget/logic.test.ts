import assert from 'node:assert/strict';
import { bestSolution, makePuzzle, reachable, replay, roundPoints, dailyTargetPoints } from '../../../functions/shared/numbers.js';
import { scoreNumberTarget } from './logic';

// Every expression the solver gives evaluates to its value.
for (const [v, e] of reachable([100, 75, 6, 4, 3, 2])) {
  const x = Function(`return ${e.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')}`)();
  assert.equal(x, v, e);
}
// Puzzles are always solvable exactly, with a three-digit target.
for (let i = 0; i < 20; i++) {
  const p = makePuzzle();
  assert.equal(p.numbers.length, 6);
  assert.ok(p.target >= 101 && p.target <= 999);
  assert.equal(bestSolution(p.numbers, p.target)!.distance, 0);
}
// Replay checks steps and stops at the first bad one.
const r = replay([100, 75, 6, 4, 3, 2], 452, ['75x6@1000', '450+2@3000']);
assert.deepEqual([r.best, r.distance, r.ms], [452, 0, 3000]);
assert.equal(replay([100, 75, 6, 4, 3, 2], 452, ['75x6', '450+7']).best, 450); // no 7
assert.equal(replay([100, 75, 6, 4, 3, 2], 452, ['75x6', '6+2']).steps.length, 1); // 6 already used
assert.equal(replay([100, 75, 6, 4, 3, 2], 452, ['3/2']).steps.length, 0); // not whole
assert.equal(replay([100, 75, 6, 4, 3, 2], 452, ['3-3']).steps.length, 0); // only one 3
assert.equal(roundPoints(0, 0, 60), 15);
assert.equal(roundPoints(0, 60000, 60), 10);
assert.deepEqual([3, 8, 20, 30].map((d) => roundPoints(d, 0, 60)), [7, 5, 2, 0]);
assert.deepEqual([0, 5, 10, 25, 26].map(dailyTargetPoints), [5, 4, 3, 2, 1]);
const s = scoreNumberTarget([{ numbers: [100, 75, 6, 4, 3, 2], target: 452 }], 60, [
  { uid: 'a', name: 'A', rounds: ['75x6@30000;450+2@30000'] },
  { uid: 'b', name: 'B', rounds: ['100x4@1000'] },
  { uid: 'c', name: 'C', rounds: [] },
]);
assert.deepEqual(s.map((x) => [x.uid, x.score]), [['a', 13], ['b', 0], ['c', 0]]);
console.log('number target logic ok');

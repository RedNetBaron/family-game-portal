import assert from 'node:assert/strict';
import { answerOf, makeProblems, problemCount, scoreSprint, type Level } from './logic';

for (const level of ['easy', 'medium', 'hard'] as Level[]) {
  for (const p of makeProblems(level, 500)) {
    const a = answerOf(p);
    assert.ok(Number.isInteger(a) && a >= 0, `${level} ${p} = ${a}`);
  }
}
assert.equal(problemCount(60), 110);
assert.equal(problemCount(300), 400);
const s = scoreSprint(['2+2', '3x3', '8/2'], [
  { uid: 'a', name: 'A', answers: ['4', '-', '4'] },
  { uid: 'b', name: 'B', answers: ['4', '9', '5'] },
]);
assert.deepEqual(s.map((x) => [x.uid, x.right, x.skipped]), [['a', 2, 1], ['b', 2, 0]].sort((x, y) => (x[2] as number) - (y[2] as number)));
console.log('math sprint logic ok');

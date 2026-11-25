import { findPath, makeGrid, scoreRound, solve, wordPoints } from './logic';

let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}

const grid = ['C', 'A', 'T', 'S', 'X', 'R', 'E', 'X', 'QU', 'I', 'T', 'X', 'X', 'X', 'X', 'X'];
// C A T S
// X R E X
// QU I T X
check('finds CAT', JSON.stringify(findPath(grid, 'cat')) === '[0,1,2]');
check('finds QUIT via Qu tile', findPath(grid, 'quit') !== null);
check('no reuse of a tile', findPath(grid, 'tat') === null);
check('not adjacent', findPath(grid, 'cs') === null);
check('points', [wordPoints('cat'), wordPoints('cats'), wordPoints('crate'), wordPoints('crates'), wordPoints('abcdefg'), wordPoints('abcdefgh')].join() === '1,1,2,3,5,11');

const res = scoreRound([
  { uid: 'a', name: 'A', words: ['cat', 'crate', 'cat'] },
  { uid: 'b', name: 'B', words: ['cat', 'tie'] },
]);
check('shared words score zero', res.find((r) => r.uid === 'a')!.score === 2 && res.find((r) => r.uid === 'b')!.score === 1);
check('winner first', res[0].uid === 'a');

const dict = new Set(['cat', 'cats', 'rat', 'quit', 'zzz']);
const prefixes = new Set<string>();
for (const w of dict) for (let i = 1; i < w.length; i++) prefixes.add(w.slice(0, i));
const all = solve(grid, dict, prefixes);
check('solver', all.includes('cat') && all.includes('quit') && !all.includes('zzz'));

for (let i = 0; i < 200; i++) {
  const g = makeGrid();
  if (g.length !== 16) check('grid size', false);
}
check('grids generate', true);

if (failures) process.exit(1);

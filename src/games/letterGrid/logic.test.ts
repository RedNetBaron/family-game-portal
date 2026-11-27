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

for (const size of [5, 6, 7]) {
  for (let i = 0; i < 100; i++) {
    const g = makeGrid(size);
    if (g.length !== size * size) check(`grid size ${size}`, false);
  }
}
check('grids generate for 5, 6, 7', true);

// 5x5: row 0 = C A T X X, row 1 = X X X S X -> "cats" needs T(2)->S(8): adjacent diagonally.
const g5 = ['C', 'A', 'T', 'X', 'X', 'X', 'X', 'X', 'S', 'X', ...Array(15).fill('X')];
check('5x5 path', JSON.stringify(findPath(g5, 'cats')) === '[0,1,2,8]');
// On a 5x5 board tile 4 (end of row 0) is not next to tile 5 (start of row 1).
const g5b = ['X', 'X', 'X', 'C', 'A', 'T', ...Array(19).fill('X')];
check('5x5 no wrap-around', findPath(g5b, 'cat') === null);
const g6 = Array(36).fill('X'); g6[0] = 'D'; g6[7] = 'O'; g6[14] = 'G';
check('6x6 diagonal path', JSON.stringify(findPath(g6, 'dog')) === '[0,7,14]');

// 7x7: tile 6 (end of row 0) is not next to tile 7; diagonal 0 -> 8 -> 16 works.
const g7 = Array(49).fill('X'); g7[0] = 'D'; g7[8] = 'O'; g7[16] = 'G';
check('7x7 diagonal path', JSON.stringify(findPath(g7, 'dog')) === '[0,8,16]');
const g7b = Array(49).fill('X'); g7b[5] = 'C'; g7b[6] = 'A'; g7b[7] = 'T';
check('7x7 no wrap-around', findPath(g7b, 'cat') === null);
check('grid defaults to 5x5', makeGrid().length === 25);

if (failures) process.exit(1);

import { normalize, scoreGame, startsWithLetter } from './logic';
import { CATEGORIES, pickCategories } from './categories';

let failures = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};

check('normalize drops article', normalize('The Beatles!') === 'beatles');
check('starts with letter ignoring "the"', startsWithLetter('The Bahamas', 'b'));
check('wrong letter', !startsWithLetter('apple', 'b'));
check('categories unique', new Set(CATEGORIES).size === CATEGORIES.length);
check('pick 12 distinct', new Set(pickCategories(12)).size === 12);

const plays = [
  { uid: 'a', name: 'A', answers: ['Banana', 'bear', 'Boston', ''] },
  { uid: 'b', name: 'B', answers: ['banana', 'Bison', 'apple', 'Bob'] },
  { uid: 'c', name: 'C', answers: ['Blueberry', 'Bat', 'Berlin', 'Bill'] },
];
// b and c both reject A's "bear" (category 1) -> majority of the 2 others.
// Only c rejects B's "Bob" (category 3) -> not a majority.
const votes = { b: { '1|a': true }, c: { '1|a': true, '3|b': true } };
const { byCategory, standings } = scoreGame('B', 4, plays, votes);
check('duplicates score 0', byCategory[0][0].status === 'duplicate' && byCategory[0][1].status === 'duplicate');
check('unique scores 1', byCategory[0][2].points === 1);
check('majority reject', byCategory[1][0].status === 'rejected');
check('minority reject kept', byCategory[3][1].status === 'ok');
check('wrong letter', byCategory[2][1].status === 'wrong-letter');
check('blank', byCategory[3][0].status === 'blank');
check('totals', JSON.stringify(standings.map((s) => [s.uid, s.score])) === '[["c",4],["b",2],["a",1]]');

if (failures) process.exit(1);

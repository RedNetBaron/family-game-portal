import { answerPoints, decodeAnswer, encodeAnswer, pickQuestions, roundSeconds, scoreTrivia } from './logic';
import { BANK, CATEGORIES } from './questions';

let failures = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};

let bad = 0;
const seen = new Set<string>();
for (const c of CATEGORIES) {
  for (const [q, r, w1, w2, w3] of BANK[c]) {
    if (new Set([r, w1, w2, w3]).size !== 4) { bad++; console.log('  duplicate choice:', q); }
    if (seen.has(q)) { bad++; console.log('  duplicate question:', q); }
    seen.add(q);
  }
}
check(`bank is clean (${seen.size} questions)`, bad === 0);
const qs = pickQuestions(['Geography', 'Sports'], 15);
check('picks 15 from chosen categories', qs.length === 15 && qs.every((q) => q.category === 'Geography' || q.category === 'Sports'));
check('answer index points at the right choice', qs.every((q) => q.choices.length === 4 && q.answer >= 0 && q.answer < 4));
check('round seconds', roundSeconds(10, 20) === 220);
check('encode/decode', JSON.stringify(decodeAnswer(encodeAnswer(2, 1234.4))) === '{"choice":2,"ms":1234}');
const q = { category: 'Geography' as const, question: '?', choices: ['a', 'b', 'c', 'd'], answer: 1 };
check('instant right answer = 150', answerPoints(q, { choice: 1, ms: 0 }, 10) === 150);
check('last-second right answer = 100', answerPoints(q, { choice: 1, ms: 10000 }, 10) === 100);
check('wrong = 0', answerPoints(q, { choice: 2, ms: 0 }, 10) === 0);
check('timeout = 0', answerPoints(q, { choice: -1, ms: 10000 }, 10) === 0);
const s = scoreTrivia([q, q], 10, [
  { uid: 'a', name: 'A', answers: ['1:5000', '2:100'] },
  { uid: 'b', name: 'B', answers: ['1:1000', '1:9000'] },
]);
check('standings', s[0].uid === 'b' && s[0].correct === 2 && s[1].score === 125);
if (failures) process.exit(1);

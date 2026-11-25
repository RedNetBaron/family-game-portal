// Daily Word rules (no Firebase imports).

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Marks a guess against the answer: one letter per position,
 * 'c' = right letter in the right spot, 'p' = in the word elsewhere, 'a' = not in the word.
 * Repeated letters are only marked as often as they appear in the answer.
 */
export function markGuess(guess, answer) {
  const marks = Array(guess.length).fill('a');
  const left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'c';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'c') continue;
    if (left[guess[i]]) {
      marks[i] = 'p';
      left[guess[i]] -= 1;
    }
  }
  return marks.join('');
}

export function cleanGuess(raw) {
  return String(raw || '').trim().toLowerCase();
}

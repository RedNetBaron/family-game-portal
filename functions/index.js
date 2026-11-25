import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { createRequire } from 'node:module';
import { cleanGuess, markGuess, MAX_GUESSES, WORD_LENGTH } from './shared/dailyword.js';
import { dailyWordPoints, familyDay, familyMonth, monthName, previousDay, previousMonth, standings } from './shared/scoring.js';
import { DEAD_TOKEN_CODES, dueForReminder, newGameMessage, recipients, reminderMessage, REMIND_HOURS_BEFORE } from './notify.js';

initializeApp();
// Small family app: keep it to one instance so it can never fan out cost.
setGlobalOptions({ region: 'us-central1', maxInstances: 1, memory: '256MiB' });

const db = getFirestore();
const require = createRequire(import.meta.url);
const VALID = new Set(require('./shared/dailyword-valid.json'));
const ANSWERS = require('./shared/dailyword-answers.json');

async function allTokens() {
  const snap = await db.collection('pushTokens').get();
  return snap.docs.map((d) => ({ token: d.id, uid: d.get('uid') }));
}

/** Sends a data-only push (the site's service worker shows it) and deletes dead tokens. */
async function send(tokens, msg) {
  if (!tokens.length) return 0;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title: msg.title, body: msg.body, link: msg.link, tag: msg.tag || '' },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.collection('pushTokens').doc(t).delete().catch(() => undefined)));
  return res.successCount;
}

/** A new game: tell everyone except the person who started it. */
export const notifyNewGame = onDocumentCreated('games/{gameId}', async (event) => {
  const game = event.data?.data();
  if (!game) return;
  const msg = newGameMessage(event.params.gameId, game);
  if (!msg) return;
  const exclude = new Set([game.createdBy, ...Object.keys(game.players || {})]);
  const sent = await send(recipients(await allTokens(), exclude), msg);
  console.log(`new ${game.type} ${game.mode} game ${event.params.gameId}: ${sent} sent`);
});

/** Hourly: remind people who haven't played a take-turns game that closes in about 3 hours. */
export const remindTurns = onSchedule({ schedule: 'every 60 minutes', timeZone: 'America/Chicago' }, async () => {
  const now = Date.now();
  const windowMs = 3600_000;
  const from = Timestamp.fromMillis(now + REMIND_HOURS_BEFORE * 3600_000);
  const to = Timestamp.fromMillis(now + REMIND_HOURS_BEFORE * 3600_000 + windowMs);
  const snap = await db.collection('games').where('endsAt', '>=', from).where('endsAt', '<', to).get();
  if (snap.empty) return;
  const tokens = await allTokens();
  for (const d of snap.docs) {
    const game = d.data();
    if (!dueForReminder({ ...game, endsAtMs: game.endsAt?.toMillis() }, now, windowMs)) continue;
    const sent = await send(recipients(tokens, game.players || {}), reminderMessage(d.id, game, REMIND_HOURS_BEFORE));
    console.log(`reminder for ${d.id}: ${sent} sent`);
  }
});

/** Today's secret word, picked at random the first time anyone guesses. Never readable by the app. */
async function secretFor(day) {
  const ref = db.collection('dailySecrets').doc(day);
  const meta = db.collection('dailySecrets').doc('_used');
  return db.runTransaction(async (tx) => {
    const [snap, used] = await Promise.all([tx.get(ref), tx.get(meta)]);
    if (snap.exists) return snap.get('word');
    const seen = new Set(used.exists ? used.get('words') : []);
    let pool = ANSWERS.filter((w) => !seen.has(w));
    if (!pool.length) pool = ANSWERS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    tx.set(ref, { word, createdAt: FieldValue.serverTimestamp() });
    tx.set(meta, { words: FieldValue.arrayUnion(word) }, { merge: true });
    return word;
  });
}

/** One Daily Word guess. Checks it on the server so the answer never reaches anyone's phone early. */
export const dailyGuess = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const member = await db.collection('members').doc(uid).get();
  if (!member.exists) throw new HttpsError('permission-denied', 'Family members only.');
  const guess = cleanGuess(req.data?.guess);
  if (guess.length !== WORD_LENGTH || !/^[a-z]+$/.test(guess)) throw new HttpsError('invalid-argument', 'Five letters, please.');
  if (!VALID.has(guess)) throw new HttpsError('invalid-argument', 'Not in the word list.');

  const now = Date.now();
  const day = familyDay(now);
  const answer = await secretFor(day);
  const name = member.get('name');
  const playRef = db.collection('dailyPlays').doc(`${day}_${uid}`);
  const scoreRef = db.collection('dailyScores').doc(`${day}_${uid}`);
  const yesterdayRef = db.collection('dailyScores').doc(`${previousDay(day)}_${uid}`);

  return db.runTransaction(async (tx) => {
    const [play, yesterday] = await Promise.all([tx.get(playRef), tx.get(yesterdayRef)]);
    const guesses = play.exists ? play.get('guesses') : [];
    const marks = play.exists ? play.get('marks') : [];
    if (play.exists && play.get('done')) throw new HttpsError('failed-precondition', 'You already finished today.');
    guesses.push(guess);
    marks.push(markGuess(guess, answer));
    const solved = guess === answer;
    const done = solved || guesses.length >= MAX_GUESSES;
    const data = { uid, name, day, guesses, marks, solved, done, updatedAt: FieldValue.serverTimestamp() };
    if (done) {
      data.answer = answer;
      const streak = solved ? (yesterday.exists && yesterday.get('solved') ? yesterday.get('streak') || 1 : 0) + 1 : 0;
      const points = dailyWordPoints(solved, guesses.length);
      data.points = points;
      data.streak = streak;
      tx.set(scoreRef, { uid, name, day, month: familyMonth(now), solved, guesses: guesses.length, points, streak, pattern: marks, finishedAt: FieldValue.serverTimestamp() });
    }
    tx.set(playRef, data);
    return { guesses, marks, solved, done, answer: done ? answer : null, points: data.points ?? null, streak: data.streak ?? null };
  });
});

/** 8 AM on the 1st: crown last month's champion, post the recap to the chat and ping everyone. */
export const crownChampion = onSchedule({ schedule: '0 8 1 * *', timeZone: 'America/Chicago' }, async () => {
  const month = previousMonth(familyMonth(Date.now()));
  await crown(month);
});

async function crown(month) {
  const [results, daily] = await Promise.all([
    db.collection('results').where('month', '==', month).get(),
    db.collection('dailyScores').where('month', '==', month).get(),
  ]);
  const rows = standings(results.docs.map((d) => d.data()), daily.docs.map((d) => d.data()));
  if (!rows.length) return null;
  const top = rows.slice(0, 3).map((r) => ({ uid: r.uid, name: r.name, points: r.points }));
  await db.collection('champions').doc(month).set({ month, uid: top[0].uid, name: top[0].name, points: top[0].points, top, crownedAt: FieldValue.serverTimestamp() });
  const others = top.slice(1).map((r, i) => `${i ? '3rd' : '2nd'} ${r.name} (${r.points})`).join(', ');
  const text = `🏆 ${monthName(month)} champion: ${top[0].name} with ${top[0].points} points!${others ? ` ${others}.` : ''} New month, fresh start. Good luck!`;
  await db.collection('messages').add({ uid: 'family-games', name: 'Family Games', text, createdAt: FieldValue.serverTimestamp() });
  await send(recipients(await allTokens(), new Set()), { title: `${monthName(month)} champion: ${top[0].name}`, body: 'See the final standings in the Scores tab.', link: '/#/scores', tag: `champ-${month}` });
  return top;
}

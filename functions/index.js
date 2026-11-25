import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { DEAD_TOKEN_CODES, dueForReminder, newGameMessage, recipients, reminderMessage, REMIND_HOURS_BEFORE } from './notify.js';

initializeApp();
// Small family app: keep it to one instance so it can never fan out cost.
setGlobalOptions({ region: 'us-central1', maxInstances: 1, memory: '256MiB' });

const db = getFirestore();

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

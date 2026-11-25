// Pure helpers for "your turn" notifications (no Firebase imports, so they can be unit tested).

export const GAME_NAMES = {
  letterGrid: 'Letter Grid',
  categoryDash: 'Category Dash',
  trivia: 'Family Trivia',
  numberTarget: 'Number Target',
  mathSprint: 'Math Sprint',
};

/** How long before a take-turns game closes we remind people who haven't played. */
export const REMIND_HOURS_BEFORE = 3;

/** Message for a brand-new game, or null if it shouldn't notify. */
export function newGameMessage(gameId, game) {
  const name = GAME_NAMES[game.type] ?? 'a game';
  const who = game.createdByName || 'Someone';
  const link = `/#/game/${gameId}`;
  if (game.mode === 'live') {
    return { title: `${who} started a live ${name}`, body: 'Join now before it starts!', link, tag: gameId };
  }
  if (game.mode === 'turns') {
    return { title: `Your turn: ${name}`, body: `${who} started a game. You have 24 hours to play.`, link, tag: gameId };
  }
  return null;
}

export function reminderMessage(gameId, game, hoursLeft) {
  const name = GAME_NAMES[game.type] ?? 'a game';
  return {
    title: `Still your turn: ${name}`,
    body: `${game.createdByName || 'Someone'}'s game closes in about ${hoursLeft} hours.`,
    link: `/#/game/${gameId}`,
    tag: gameId,
  };
}

/**
 * Which tokens to send to: everyone except the excluded people.
 * tokens: [{ token, uid }]. exclude: set or object of uids.
 */
export function recipients(tokens, exclude) {
  const skip = exclude instanceof Set ? exclude : new Set(Object.keys(exclude || {}));
  return tokens.filter((t) => t.token && t.uid && !skip.has(t.uid)).map((t) => t.token);
}

/** True when a take-turns game closes within the next reminder window [start, start + windowMs). */
export function dueForReminder(game, now, windowMs) {
  if (game.mode !== 'turns' || !game.endsAtMs) return false;
  const start = now + REMIND_HOURS_BEFORE * 3600_000;
  return game.endsAtMs >= start && game.endsAtMs < start + windowMs;
}

/** Error codes meaning a token is dead and should be deleted. */
export const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** Push for a chat message that tags people. Returns null when nobody is tagged. */
export function mentionMessage(msg) {
  const tags = Array.isArray(msg.mentions) ? msg.mentions : [];
  if (!tags.length) return null;
  const body = String(msg.text || '').slice(0, 140);
  const everyone = tags.includes('everyone');
  return {
    title: everyone ? `${msg.name} to everyone` : `${msg.name} mentioned you`,
    body,
    link: '/#/chat',
    tag: 'chat',
    everyone,
    uids: tags.filter((t) => t !== 'everyone'),
  };
}

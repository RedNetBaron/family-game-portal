export type Person = { uid: string; name: string };

export const EVERYONE = 'everyone';

/** The partial "@name" being typed at the end of the text, or null. */
export function mentionQuery(text: string): string | null {
  const m = text.match(/(?:^|\s)@([^\s@]{0,30})$/);
  return m ? m[1] : null;
}

/** Replaces the trailing partial "@..." with the full "@Name ". */
export function insertMention(text: string, name: string): string {
  return text.replace(/@([^\s@]{0,30})$/, `@${name} `);
}

/** People suggested for a partial name (plus @everyone). */
export function suggestions(people: Person[], q: string, selfUid: string): Person[] {
  const lower = q.toLowerCase();
  const list = people.filter((p) => p.uid !== selfUid && p.name.toLowerCase().startsWith(lower));
  if (EVERYONE.startsWith(lower)) list.push({ uid: EVERYONE, name: EVERYONE });
  return list.slice(0, 6);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** uids mentioned in the text ('everyone' for @everyone). Longest names match first. */
export function findMentions(text: string, people: Person[]): string[] {
  const found = new Set<string>();
  let rest = text;
  for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(`@${escape(p.name)}(?![\\w])`, 'gi');
    if (re.test(rest)) {
      found.add(p.uid);
      rest = rest.replace(re, ' ');
    }
  }
  if (/@everyone(?![\w])/i.test(rest)) found.add(EVERYONE);
  return [...found];
}

/** Splits text into plain and @mention pieces for display. */
export function splitMentions(text: string, people: Person[]): { text: string; uid?: string }[] {
  const names = [...people.map((p) => p.name), EVERYONE].sort((a, b) => b.length - a.length);
  if (!names.length) return [{ text }];
  const re = new RegExp(`@(${names.map(escape).join('|')})(?![\\w])`, 'gi');
  const out: { text: string; uid?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    const hit = people.find((p) => p.name.toLowerCase() === m[1].toLowerCase());
    out.push({ text: m[0], uid: hit ? hit.uid : EVERYONE });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// Loads the word list (public/words.txt, from SCOWL; see public/words-LICENSE.txt) once.

export type Dictionary = { words: Set<string>; prefixes: Set<string> };

let loading: Promise<Dictionary> | null = null;

export function loadDictionary(): Promise<Dictionary> {
  if (!loading) {
    loading = fetch('/words.txt')
      .then((r) => {
        if (!r.ok) throw new Error('word list failed to load');
        return r.text();
      })
      .then((text) => {
        const words = new Set(text.split('\n').filter(Boolean));
        const prefixes = new Set<string>();
        for (const w of words) for (let i = 1; i < w.length; i++) prefixes.add(w.slice(0, i));
        return { words, prefixes };
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

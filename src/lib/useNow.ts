import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `everyMs`. */
export function useNow(everyMs = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

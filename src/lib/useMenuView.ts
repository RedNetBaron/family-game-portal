import { useEffect, useState } from 'react';

export type MenuView = 'list' | 'grid';

const KEY = 'menuView';
const EVENT = 'menuviewchange';

function read(): MenuView {
  try {
    return localStorage.getItem(KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

/** The games menu layout this phone prefers, saved on the device. */
export function useMenuView(): [MenuView, (v: MenuView) => void] {
  const [view, setView] = useState<MenuView>(read);
  useEffect(() => {
    const sync = () => setView(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (v: MenuView) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [view, set];
}

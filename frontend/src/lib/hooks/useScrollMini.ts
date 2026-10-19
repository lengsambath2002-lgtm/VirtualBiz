'use client';

import { useEffect, useState } from 'react';

/**
 * iOS 26-style floating bar behaviour (prototype `glass-js`): minimize while scrolling down
 * past 80px, expand on scroll up / near the top, and expand again 1.6 s after scrolling stops.
 */
export function useScrollMini(): boolean {
  const [mini, setMini] = useState(false);
  useEffect(() => {
    let y = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const ny = window.scrollY;
      const down = ny > y + 4;
      const up = ny < y - 4;
      if (down && ny > 80) setMini(true);
      else if (up || ny < 40) setMini(false);
      y = ny;
      clearTimeout(timer);
      timer = setTimeout(() => setMini(false), 1600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);
  return mini;
}

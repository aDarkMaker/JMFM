import {useEffect, useState} from 'react';

const DOWN_THRESHOLD = 24;
const TOP_GRACE = 64;

/**
 * Hides app chrome while the user scrolls down and reveals it on scroll up.
 * Scroll events do not bubble, so the listener runs in the capture phase and
 * only reacts to the active screen scroller (`.app-screen`).
 */
export function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = 0;
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || !el.classList?.contains('app-screen')) return;
      const y = el.scrollTop;
      if (y <= TOP_GRACE) {
        last = y;
        setHidden(false);
        return;
      }
      const delta = y - last;
      if (Math.abs(delta) < DOWN_THRESHOLD) return;
      setHidden(delta > 0);
      last = y;
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  return hidden;
}

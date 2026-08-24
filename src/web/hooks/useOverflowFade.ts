import {useEffect, useState} from 'react';

export function useOverflowFade<T extends HTMLElement>(): {
  ref: (el: T | null) => void;
  overflow: boolean;
} {
  const [overflow, setOverflow] = useState(false);
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;
    const check = () => {
      setOverflow(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return {ref: setEl, overflow};
}

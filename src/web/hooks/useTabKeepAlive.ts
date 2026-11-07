import {useCallback, useEffect, useRef, useState} from 'react';

/**
 * Keeps a screen mounted once it has been visited and restores its scroll
 * offset when it becomes visible again. Inactive panes are `hidden`, so their
 * DOM state survives tab switches while `display:none` would reset scroll.
 */
export function useTabKeepAlive(active: boolean) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(active);
  const offsets = useRef(new Map<string, number>());

  const scrollerOf = () => paneRef.current?.querySelector<HTMLElement>('.app-screen') ?? null;

  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  useEffect(() => {
    if (!active) return;
    const el = scrollerOf();
    if (!el) return;
    el.scrollTop = offsets.current.get('y') ?? 0;
  }, [active]);

  const onScrollCapture = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (!el.classList?.contains('app-screen')) return;
    offsets.current.set('y', el.scrollTop);
  }, []);

  return {paneRef, mounted, onScrollCapture};
}

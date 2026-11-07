import {useEffect, useRef} from 'react';

const PULL_TRIGGER = 80;
const PULL_MAX = 104;
const RESISTANCE = 0.5;

function scrollerOf(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  return el?.closest?.('.app-screen') ?? null;
}

function reset(el: HTMLElement) {
  el.classList.remove('is-pulling', 'is-refreshing');
  el.style.removeProperty('--pull-y');
  el.style.removeProperty('--pull-progress');
  el.style.transform = '';
}

function touchBlocked(target: EventTarget | null, scroller: HTMLElement): boolean {
  if (scroller.classList.contains('is-search-locked')) return true;
  const node = target as HTMLElement | null;
  return Boolean(node?.closest?.('.home-search-shell'));
}

/**
 * Touch-only pull-to-refresh for the active tab screen. Gesture is ignored
 * unless the scroller is already at the top. Sticky search chrome is excluded
 * so pull rubber-band never fights search focus / morph.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handler = useRef(onRefresh);
  handler.current = onRefresh;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;

    let scroller: HTMLElement | null = null;
    let startY = 0;
    let distance = 0;
    let tracking = false;
    let busy = false;

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return;
      scroller = scrollerOf(e.target);
      if (!scroller || scroller.scrollTop > 0 || touchBlocked(e.target, scroller)) {
        scroller = null;
        return;
      }
      startY = e.touches[0].clientY;
      distance = 0;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || !scroller) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || scroller.scrollTop > 0) {
        reset(scroller);
        distance = 0;
        return;
      }
      distance = Math.min(dy * RESISTANCE, PULL_MAX);
      scroller.classList.add('is-pulling');
      scroller.style.setProperty('--pull-y', `${distance}px`);
      scroller.style.setProperty('--pull-progress', String(Math.min(1, distance / PULL_TRIGGER)));
      scroller.style.transform = `translateY(${distance}px)`;
    };

    const onEnd = () => {
      const el = scroller;
      tracking = false;
      scroller = null;
      if (!el || distance <= 0) return;
      if (distance < PULL_TRIGGER) {
        reset(el);
        distance = 0;
        return;
      }
      busy = true;
      distance = 0;
      // Snap back immediately; refresh runs without a spinner overlay.
      reset(el);
      void Promise.resolve(handler.current())
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };

    container.addEventListener('touchstart', onStart, {passive: true});
    container.addEventListener('touchmove', onMove, {passive: true});
    container.addEventListener('touchend', onEnd);
    container.addEventListener('touchcancel', onEnd);
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return containerRef;
}

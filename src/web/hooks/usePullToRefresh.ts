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
  el.style.removeProperty('--pull-progress');
  el.style.transform = '';
}

/**
 * Touch-only pull-to-refresh for the active tab screen. Gesture is ignored
 * unless the scroller is already at the top.
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
      if (!scroller || scroller.scrollTop > 0) {
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
      el.classList.remove('is-pulling');
      el.classList.add('is-refreshing');
      el.style.transform = `translateY(${PULL_TRIGGER / 2}px)`;
      void Promise.resolve(handler.current())
        .catch(() => undefined)
        .finally(() => {
          busy = false;
          reset(el);
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

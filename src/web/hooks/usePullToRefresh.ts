import {useEffect, useRef} from 'react';

const PULL_TRIGGER = 80;
const PULL_MAX = 104;
const RESISTANCE = 0.5;

function scrollerOf(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  return el?.closest?.('.app-screen') ?? null;
}

function reset(el: HTMLElement) {
  el.classList.remove('is-pulling');
  el.style.removeProperty('--pull-y');
  el.style.transform = '';
}

function touchBlocked(target: EventTarget | null, scroller: HTMLElement): boolean {
  if (scroller.classList.contains('is-search-locked')) return true;
  const node = target as HTMLElement | null;
  return Boolean(node?.closest?.('.sticky-chrome'));
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

    const cancel = () => {
      tracking = false;
      distance = 0;
      if (scroller) reset(scroller);
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || !scroller) return;
      const dy = e.touches[0].clientY - startY;
      // Pushing back past the start point cancels the gesture outright; rebasing
      // on a partial pull would let a short flick reach the trigger.
      if (dy <= 0 || scroller.scrollTop > 0) {
        cancel();
        return;
      }
      distance = Math.min(dy * RESISTANCE, PULL_MAX);
      scroller.classList.add('is-pulling');
      scroller.style.setProperty('--pull-y', `${distance}px`);
      scroller.style.transform = `translateY(${distance}px)`;
    };

    const onEnd = () => {
      const el = scroller;
      const reached = tracking && distance >= PULL_TRIGGER;
      tracking = false;
      scroller = null;
      distance = 0;
      if (!el) return;
      reset(el);
      if (!reached) return;
      busy = true;
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

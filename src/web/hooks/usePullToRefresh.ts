/** Touch-only pull-to-refresh state machine for the active tab screen. */
import {useEffect, useRef} from 'react';

const PULL_TRIGGER = 80;
const PULL_MAX = 104;
const RESISTANCE = 0.5;
const REBOUND_MS = 200;

function scrollerOf(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  return el?.closest?.('.app-screen') ?? null;
}

/**
 * Drops the pull offset and springs the moved children back. Uses WAAPI on the
 * children so no extra transition rule has to live in the global stylesheet.
 */
function rebound(el: HTMLElement, from: number) {
  el.classList.remove('is-pulling');
  el.style.removeProperty('--pull-y');
  if (from <= 0) return;
  // Only the non-sticky children were translated; the sticky chrome never moved.
  for (const kid of el.querySelectorAll<HTMLElement>(':scope > :not(.sticky-chrome)')) {
    kid.animate(
      [{transform: `translate3d(0, ${from}px, 0)`}, {transform: 'translate3d(0, 0, 0)'}],
      {duration: REBOUND_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)'}
    );
  }
}

function touchBlocked(target: EventTarget | null, scroller: HTMLElement): boolean {
  if (scroller.classList.contains('is-search-locked')) return true;
  const node = target as HTMLElement | null;
  return Boolean(node?.closest?.('.sticky-chrome'));
}

/**
 * Touch-only pull-to-refresh for the active tab screen. Gesture is ignored
 * unless the scroller is already at the top. Sticky chrome is never translated:
 * only the non-sticky children move, so `position: sticky` keeps working.
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
    let raf = 0;

    const flush = () => {
      raf = 0;
      if (!scroller) return;
      scroller.style.setProperty('--pull-y', `${distance}px`);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(flush);
    };

    const stopRaf = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || !scroller) return;
      const dy = e.touches[0].clientY - startY;
      // Pushing back past the start point cancels the gesture outright; rebasing
      // on a partial pull would let a short flick reach the trigger.
      if (dy <= 0 || scroller.scrollTop > 0) {
        tracking = false;
        stopRaf();
        rebound(scroller, distance);
        distance = 0;
        return;
      }
      // Owning the gesture means native overscroll must not run in parallel.
      if (e.cancelable) e.preventDefault();
      distance = Math.min(dy * RESISTANCE, PULL_MAX);
      scroller.classList.add('is-pulling');
      schedule();
    };

    // Bound only while a pull is tracked: a permanently non-passive touchmove
    // listener would keep scrolling off the compositor fast path.
    const track = () => container.addEventListener('touchmove', onMove, {passive: false});
    const untrack = () => container.removeEventListener('touchmove', onMove);

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return;
      untrack();
      scroller = scrollerOf(e.target);
      if (!scroller || scroller.scrollTop > 0 || touchBlocked(e.target, scroller)) {
        scroller = null;
        return;
      }
      startY = e.touches[0].clientY;
      distance = 0;
      tracking = true;
      track();
    };

    const onEnd = () => {
      const el = scroller;
      const from = distance;
      const reached = tracking && from >= PULL_TRIGGER;
      tracking = false;
      scroller = null;
      distance = 0;
      stopRaf();
      untrack();
      if (!el) return;
      rebound(el, from);
      if (!reached) return;
      busy = true;
      void Promise.resolve(handler.current())
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };

    container.addEventListener('touchstart', onStart, {passive: true});
    container.addEventListener('touchend', onEnd);
    container.addEventListener('touchcancel', onEnd);
    return () => {
      stopRaf();
      untrack();
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return containerRef;
}

import {useEffect, useRef} from 'react';
import {clamp, SCALE_MAX, SCALE_MIN, TouchState} from './types';
import * as paged from './paged-viewer';
import * as scroll from './scroll-viewer';
import {PagedViewerCtx} from './paged-viewer';
import {ScrollViewerCtx} from './scroll-viewer';

export interface GestureViewerCtx extends PagedViewerCtx, ScrollViewerCtx {
  isScroll: boolean;
  touchStateRef: {current: TouchState};
  rafRef: {current: number};
  goTo: (next: number) => void;
}

export function useTouchGestures(ctx: GestureViewerCtx, el: HTMLElement | null): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      const c = ctxRef.current;
      if (e.touches.length === 2) {
        if (c.animatingRef.current) return;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        c.touchStateRef.current = {
          type: 'pinch',
          dist,
          scale: c.scaleRef.current,
          focalY: c.isScroll ? scroll.getScrollFocalY(c, [e.touches[0], e.touches[1]], el) : 0,
          baseScrollTop: c.isScroll ? el.scrollTop : 0,
        };
      } else if (e.touches.length === 1 && !c.touchStateRef.current) {
        c.touchStateRef.current = {
          type: 'pan',
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const applyScale = (s: number) => {
      const c = ctxRef.current;
      if (c.isScroll) {
        const st = c.touchStateRef.current;
        scroll.applyScrollScaleTransform(c, s, st?.type === 'pinch' ? st : null);
      } else {
        const canvas = c.frontRef.current;
        if (canvas) {
          canvas.style.transform = `scale(${s / c.renderedScaleRef.current})`;
        }
      }
    };

    const resetScale = () => {
      const c = ctxRef.current;
      if (c.isScroll) {
        scroll.resetScrollScaleTransform(c);
      } else {
        const canvas = c.frontRef.current;
        if (canvas) {
          canvas.style.transform = 'none';
        }
      }
    };

    const onMove = (e: TouchEvent) => {
      const c = ctxRef.current;
      const st = c.touchStateRef.current;
      if (st?.type === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const s = clamp(st.scale * (dist / st.dist), SCALE_MIN, SCALE_MAX);
        if (Math.abs(s - c.scaleRef.current) > 0.02) {
          c.scaleRef.current = s;
          if (!c.rafRef.current) {
            c.rafRef.current = requestAnimationFrame(() => {
              c.rafRef.current = 0;
              applyScale(c.scaleRef.current);
            });
          }
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      const c = ctxRef.current;
      const st = c.touchStateRef.current;
      c.touchStateRef.current = null;
      if (st?.type === 'pinch') {
        cancelAnimationFrame(c.rafRef.current);
        c.rafRef.current = 0;
        if (Math.abs(c.scaleRef.current - c.renderedScaleRef.current) > 0.02) {
          applyScale(c.scaleRef.current);
          if (c.isScroll) {
            scroll.scaleScrollWithAnchor(c, fn => scroll.renderAllPages(c, false, fn), st.focalY);
          } else {
            void paged.reRenderPaged(c);
          }
        } else {
          resetScale();
        }
        return;
      }
      if (st?.type === 'pan' && !c.isScroll && e.changedTouches.length > 0) {
        const dx = e.changedTouches[0].clientX - st.x;
        const dy = e.changedTouches[0].clientY - st.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          const next = dx < 0 ? c.pageNumRef.current + 1 : c.pageNumRef.current - 1;
          const total = c.docRef.current?.numPages ?? 0;
          if (next >= 1 && next <= total) {
            c.goTo(next);
          }
        }
      }
    };

    el.addEventListener('touchstart', onStart, {passive: true});
    el.addEventListener('touchmove', onMove, {passive: false});
    el.addEventListener('touchend', onEnd, {passive: true});
    el.addEventListener('touchcancel', onEnd, {passive: true});
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [el]);
}

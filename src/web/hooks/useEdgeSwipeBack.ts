import {useEffect, useRef} from 'react';
import {useNavStore} from '@/web/stores/nav';
import {NAV_CLOSE_MS} from './useNavStack';

const EDGE_WIDTH = 28;
const TRIGGER = 64;
const MAX_DRAG = 140;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * iOS-style left-edge swipe to pop the topmost nav overlay. Drag tracks the
 * finger; a commit continues from the current offset and finishes the pop
 * without replaying the CSS exit animation.
 */
export function useEdgeSwipeBack(_onBack: () => void, enabled: boolean) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let active = false;
    let committing = false;

    const clearInline = (layer: HTMLElement) => {
      layer.style.transition = '';
      layer.style.transform = '';
      layer.style.animation = '';
    };

    const onStart = (e: TouchEvent) => {
      if (committing || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_WIDTH) return;
      startX = touch.clientX;
      startY = touch.clientY;
      dx = 0;
      active = true;
      const layer = layerRef.current;
      if (layer) {
        layer.style.animation = 'none';
        layer.style.transition = 'none';
        layer.style.transform = 'translate3d(0,0,0)';
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!active || committing) return;
      const touch = e.touches[0];
      const moveX = touch.clientX - startX;
      const moveY = touch.clientY - startY;
      if (Math.abs(moveY) > Math.abs(moveX) * 1.4) {
        active = false;
        const layer = layerRef.current;
        if (layer) clearInline(layer);
        return;
      }
      if (moveX <= 0) return;
      dx = Math.min(moveX, MAX_DRAG);
      const layer = layerRef.current;
      if (layer) layer.style.transform = `translate3d(${dx}px,0,0)`;
    };

    const onEnd = () => {
      if (!active || committing) return;
      active = false;
      const layer = layerRef.current;
      if (!layer) {
        dx = 0;
        return;
      }
      if (dx >= TRIGGER) {
        committing = true;
        layer.style.transition = `transform ${NAV_CLOSE_MS}ms ${EASE}`;
        layer.style.transform = 'translate3d(100%,0,0)';
        window.setTimeout(() => {
          clearInline(layer);
          const {stack, closing} = useNavStore.getState();
          if (!closing && stack.length > 0) {
            useNavStore.setState({stack: stack.slice(0, -1), closing: null});
          }
          committing = false;
        }, NAV_CLOSE_MS);
      } else {
        layer.style.transition = `transform 220ms ${EASE}`;
        layer.style.transform = 'translate3d(0,0,0)';
        window.setTimeout(() => clearInline(layer), 220);
      }
      dx = 0;
    };

    document.addEventListener('touchstart', onStart, {passive: true});
    document.addEventListener('touchmove', onMove, {passive: true});
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return layerRef;
}

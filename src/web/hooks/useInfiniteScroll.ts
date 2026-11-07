import {useCallback, useEffect, useRef, useState} from 'react';

export interface InfiniteScrollOptions {
  /** Called when the sentinel gets within `rootMargin`. */
  onLoadMore: () => void;
  /** Disable while a request is inflight or the feed ended. */
  disabled: boolean;
  rootMargin?: string;
}

/**
 * IntersectionObserver sentinel for list pagination.
 * Attach `ref` to an element placed after the last row.
 */
export function useInfiniteScroll({
  onLoadMore,
  disabled,
  rootMargin = '400px',
}: InfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  /** Remember the disabled state of the last trigger so a visible sentinel
   * does not re-fire after every unrelated re-render. */
  const firedRef = useRef(false);

  const loadMore = useCallback(() => {
    if (disabled) return;
    if (firedRef.current) return;
    firedRef.current = true;
    onLoadMore();
  }, [disabled, onLoadMore]);

  // Re-arm once the request settles (loading/end flips back to false).
  useEffect(() => {
    if (!disabled) firedRef.current = false;
  }, [disabled]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        setVisible(hit);
        if (hit) loadMore();
      },
      {rootMargin}
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, rootMargin]);

  // Re-trigger only when a load finished while the sentinel stayed visible.
  useEffect(() => {
    if (visible) loadMore();
  }, [visible, loadMore]);

  return sentinelRef;
}

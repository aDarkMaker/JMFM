import {forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, useState} from 'react';
import {clamp, SCALE_MAX, SCALE_MIN} from './types';
import {getImageDocMeta, loadImageDocMeta, prefetchPageSrcs, ImageDocMeta} from './image-doc';

export interface ImageReaderHandle {
  goTo: (n: number) => void;
  zoom: (factor: number) => void;
  fitToWidth: () => void;
  getPage: () => number;
}

interface ImageReaderProps {
  pagesDir: string;
  pageCount?: number;
  mode: 'scroll' | 'paged';
  onPageChange: (p: number) => void;
  onReady: (total: number) => void;
  onError: (e: string | null) => void;
}

const LAZY_RANGE = 3;
const PREFETCH_AHEAD = 8;
const PAGED_FLIP_MS = 250;
const SCROLL_WINDOW_BACK = 3;
const SCROLL_WINDOW_FRONT = 6;
const PAGE_GAP = 12; // var(--space-3)
const PLACEHOLDER_RATIO = 4 / 3;

export const ImageReader = forwardRef<ImageReaderHandle, ImageReaderProps>(function ImageReader(
  {pagesDir, pageCount, mode, onPageChange, onReady, onError},
  ref,
) {
  const [meta, setMeta] = useState<ImageDocMeta | null>(() => getImageDocMeta(pagesDir) ?? null);
  const [page, setPage] = useState(1);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const pageRef = useRef(1);
  const scaleRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const pageRatioRef = useRef<Map<number, number>>(new Map());
  const scrollRafRef = useRef(0);
  const pagedAreaRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLImageElement>(null);
  const backRef = useRef<HTMLImageElement>(null);
  const animatingRef = useRef(false);
  const touchRef = useRef<{x: number; y: number} | null>(null);
  const pinchRef = useRef<{dist: number; scale: number} | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onPageChangeRef.current = onPageChange;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  const total = meta?.pageCount ?? pageCount ?? 0;

  const renderSrc = useCallback(
    (index: number): string | undefined => {
      if (!meta) return undefined;
      const existing = meta.srcs[index];
      if (existing) return existing;
      if (Math.abs(index + 1 - pageRef.current) <= LAZY_RANGE) {
        void prefetchPageSrcs(meta, [index]).then(bump);
      }
      return undefined;
    },
    [meta],
  );

  const resolveInitial = useCallback(async (m: ImageDocMeta) => {
    const indices: number[] = [];
    const start = Math.max(0, pageRef.current - 1 - LAZY_RANGE);
    const end = Math.min(m.pageCount, pageRef.current - 1 + PREFETCH_AHEAD);
    for (let i = start; i < end; i++) {
      if (!m.srcs[i]) indices.push(i);
    }
    await prefetchPageSrcs(m, indices);
  }, []);

  useEffect(() => {
    let alive = true;
    const cached = getImageDocMeta(pagesDir);
    if (cached) {
      setMeta(cached);
      onReadyRef.current(cached.pageCount);
      void resolveInitial(cached).then(bump);
      return;
    }
    loadImageDocMeta(pagesDir)
      .then(m => {
        if (!alive) return;
        setMeta(m);
        onReadyRef.current(m.pageCount);
        void resolveInitial(m).then(bump);
      })
      .catch(e => {
        if (alive) {
          onErrorRef.current(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [pagesDir, resolveInitial]);

  const prefetchVisible = useCallback(() => {
    if (!meta) return;
    const cur = pageRef.current;
    const indices: number[] = [];
    for (let d = -LAZY_RANGE; d <= PREFETCH_AHEAD; d++) {
      const i = cur - 1 + d;
      if (i >= 0 && i < meta.pageCount && !meta.srcs[i]) {
        indices.push(i);
      }
    }
    if (indices.length > 0) {
      void prefetchPageSrcs(meta, indices).then(bump);
    }
  }, [meta]);

  useEffect(() => {
    prefetchVisible();
  }, [prefetchVisible, page]);

  const flipTo = useCallback(
    async (n: number) => {
      const front = frontRef.current;
      const back = backRef.current;
      if (!front || !back || animatingRef.current) return;
      const next = clamp(n, 1, Math.max(1, total));
      if (next === pageRef.current) return;
      const dir = next > pageRef.current ? 1 : -1;
      animatingRef.current = true;
      const backSrc = renderSrc(next - 1);
      if (backSrc) back.src = backSrc;
      back.style.transform = `translate3d(${dir * 100}%, 0, 0)`;
      back.style.visibility = 'visible';
      pageRef.current = next;
      setPage(next);
      onPageChangeRef.current(next);
      const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
      const backAnim = back.animate(
        [
          {transform: `translate3d(${dir * 100}%, 0, 0)`},
          {transform: 'translate3d(0, 0, 0)'},
        ],
        {duration: PAGED_FLIP_MS, easing, fill: 'both'},
      );
      const frontAnim = front.animate(
        [
          {transform: 'translate3d(0, 0, 0)'},
          {transform: `translate3d(${-dir * 100}%, 0, 0)`},
        ],
        {duration: PAGED_FLIP_MS, easing, fill: 'both'},
      );
      await Promise.all([backAnim.finished, frontAnim.finished].map(p => p.catch(() => {})));
      try {
        backAnim.commitStyles();
        frontAnim.commitStyles();
      } catch {
        // older WebViews
      }
      backAnim.cancel();
      frontAnim.cancel();
      if (backSrc) front.src = backSrc;
      front.style.transform = 'none';
      front.style.visibility = 'visible';
      back.style.transform = 'none';
      back.style.visibility = 'hidden';
      animatingRef.current = false;
    },
    [renderSrc, total],
  );

  const pageWidth = useCallback(() => {
    const area = scrollRef.current;
    if (!area) return 320;
    return Math.max((area.clientWidth - 24) * scaleRef.current, 240);
  }, []);

  const pageHeight = useCallback(
    (i: number) => pageWidth() * (pageRatioRef.current.get(i) ?? PLACEHOLDER_RATIO) + PAGE_GAP,
    [pageWidth],
  );

  const offsetOf = useCallback(
    (index: number) => {
      let s = 0;
      for (let j = 0; j < index; j++) {
        s += pageHeight(j + 1);
      }
      return s;
    },
    [pageHeight],
  );

  const goTo = useCallback(
    (n: number) => {
      const next = clamp(n, 1, Math.max(1, total));
      if (mode === 'scroll') {
        pageRef.current = next;
        setPage(next);
        onPageChangeRef.current(next);
        const area = scrollRef.current;
        if (area) {
          area.scrollTo({top: offsetOf(next - 1) - 8, behavior: 'smooth'});
        }
      } else {
        void flipTo(next);
      }
    },
    [mode, total, flipTo, offsetOf],
  );

  const applyWidth = useCallback(
    (s: number) => {
      const area = scrollRef.current;
      if (!area) return;
      const w = `${Math.max((area.clientWidth - 24) * s, 240)}px`;
      pageElsRef.current.forEach(el => {
        el.style.width = w;
      });
      bump();
    },
    [],
  );

  const applyPagedWidth = useCallback(
    (s: number) => {
      const area = pagedAreaRef.current;
      if (!area) return;
      const baseW = Math.max(area.clientWidth - 32, 240);
      const w = `${Math.max(baseW * s, 240)}px`;
      [frontRef.current, backRef.current].forEach(img => {
        if (img) {
          img.style.width = w;
          img.style.height = 'auto';
        }
      });
    },
    [],
  );

  const zoom = useCallback(
    (factor: number) => {
      const s = clamp(scaleRef.current * factor, SCALE_MIN, SCALE_MAX);
      scaleRef.current = s;
      if (mode === 'scroll') {
        applyWidth(s);
      } else {
        applyPagedWidth(s);
      }
    },
    [mode, applyWidth, applyPagedWidth],
  );

  const fitToWidth = useCallback(() => {
    scaleRef.current = 1;
    if (mode === 'scroll') {
      applyWidth(1);
    } else {
      applyPagedWidth(1);
    }
  }, [mode, applyWidth, applyPagedWidth]);

  useImperativeHandle(ref, () => ({
    goTo,
    zoom,
    fitToWidth,
    getPage: () => pageRef.current,
  }), [goTo, zoom, fitToWidth]);

  useEffect(() => {
    if (mode === 'scroll') {
      if (meta) {
        applyWidth(scaleRef.current);
      }
      return;
    }
    const area = pagedAreaRef.current;
    if (!area) return;
    applyPagedWidth(scaleRef.current);
    const ro = new ResizeObserver(() => applyPagedWidth(scaleRef.current));
    ro.observe(area);
    return () => ro.disconnect();
  }, [mode, meta, applyWidth, applyPagedWidth]);

  const onScroll = useCallback(() => {
    const area = scrollRef.current;
    if (!area || scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const a = scrollRef.current;
      if (!a) return;
      const threshold = a.scrollTop + a.clientHeight * 0.3;
      let lo = 0;
      let hi = total;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (offsetOf(mid) <= threshold) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      let cur = Math.max(1, lo);
      if (a.scrollTop + a.clientHeight >= a.scrollHeight - 4) {
        cur = total;
      }
      if (cur !== pageRef.current) {
        pageRef.current = cur;
        setPage(cur);
        onPageChangeRef.current(cur);
      }
    });
  }, [total, offsetOf]);

  const onImgLoad = useCallback(
    (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth > 0) {
        pageRatioRef.current.set(i + 1, img.naturalHeight / img.naturalWidth);
        bump();
      }
    },
    [],
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
        scale: scaleRef.current,
      };
      touchRef.current = null;
    } else if (e.touches.length === 1) {
      touchRef.current = {x: e.touches[0].clientX, y: e.touches[0].clientY};
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const p = pinchRef.current;
      if (p && e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const s = clamp(p.scale * (dist / p.dist), SCALE_MIN, SCALE_MAX);
        scaleRef.current = s;
        if (mode === 'scroll') {
          applyWidth(s);
        } else {
          applyPagedWidth(s);
        }
      }
    },
    [mode, applyWidth, applyPagedWidth],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      pinchRef.current = null;
      const t = touchRef.current;
      touchRef.current = null;
      if (t && e.changedTouches.length > 0 && mode === 'paged') {
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          const next = dx < 0 ? pageRef.current + 1 : pageRef.current - 1;
          if (next >= 1 && next <= total) {
            void flipTo(next);
          }
        }
      }
    },
    [mode, total, flipTo],
  );

  if (mode === 'scroll') {
    const cur = clamp(page, 1, Math.max(1, total));
    const start = Math.max(0, cur - 1 - SCROLL_WINDOW_BACK);
    const end = Math.min(total, cur - 1 + SCROLL_WINDOW_FRONT + 1);
    const windowIndices: number[] = [];
    for (let i = start; i < end; i++) {
      windowIndices.push(i);
    }
    const totalHeight = offsetOf(total);
    return (
      <div
        className="reader-scroll-area reader-img-area"
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {total > 0 ? (
          <div className="reader-scroll-content">
            <div className="reader-scroll-spacer" style={{height: offsetOf(start)}} />
            {windowIndices.map(i => (
              <div
                className="reader-scroll-page"
                key={i}
                ref={el => {
                  if (el) pageElsRef.current.set(i + 1, el);
                  else pageElsRef.current.delete(i + 1);
                }}
              >
                <img
                  className="reader-img"
                  data-page={i + 1}
                  src={renderSrc(i)}
                  loading="eager"
                  decoding="async"
                  onLoad={onImgLoad(i)}
                  alt=""
                />
              </div>
            ))}
            <div className="reader-scroll-spacer" style={{height: Math.max(0, totalHeight - offsetOf(end))}} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={pagedAreaRef}
      className="reader-paged-area reader-img-paged-area"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {total > 0 ? (
        <>
          <img ref={frontRef} className="reader-img reader-img-paged" src={renderSrc(page - 1)} alt="" />
          <img ref={backRef} className="reader-img reader-img-paged" style={{visibility: 'hidden'}} alt="" />
        </>
      ) : null}
    </div>
  );
});

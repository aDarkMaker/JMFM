import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';
import {clamp, SCALE_MAX, SCALE_MIN} from './types';
import {getImageDocMeta, loadImageDocMeta, ImageDocMeta} from './image-doc';
import {applyToImg} from './image-loader';

export interface ImageReaderHandle {
  goTo: (n: number) => void;
  zoom: (factor: number) => void;
  fitToWidth: () => void;
}

interface ImageReaderProps {
  pagesDir: string;
  pageCount?: number;
  mode: 'scroll' | 'paged';
  onPageChange: (p: number) => void;
  onReady: (total: number) => void;
  onError: (e: string | null) => void;
}

const PAGE_GAP = 12;
const SLOT_RATIO = 4 / 3;
const SCROLL_BACK = 1;
const SCROLL_FRONT = 8;
const SCROLL_EDGE = 2;
const PAGED_FLIP_MS = 200;
const SWIPE_MIN = 48;

export const ImageReader = forwardRef<ImageReaderHandle, ImageReaderProps>(function ImageReader(
  {pagesDir, mode, onPageChange, onReady, onError},
  ref
) {
  const metaRef = useRef<ImageDocMeta | null>(getImageDocMeta(pagesDir) ?? null);
  const pageRef = useRef(1);
  const scaleRef = useRef(1);
  const slotWRef = useRef(320);
  const slotHRef = useRef(320 * SLOT_RATIO + PAGE_GAP);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const scrollPagesRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef(new Map<number, HTMLElement>());
  const poolRef = useRef(new Map<number, HTMLElement>());
  const scrollWindowRef = useRef({start: -1, end: -1});
  const scrollRafRef = useRef(0);
  const windowRafRef = useRef(0);
  const pendingPageRef = useRef(0);
  const pagedAreaRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<
    [HTMLImageElement | null, HTMLImageElement | null, HTMLImageElement | null]
  >([null, null, null]);
  const animatingRef = useRef(false);
  const touchRef = useRef<{x: number; y: number; t: number} | null>(null);
  const pinchRef = useRef<{dist: number; scale: number} | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onPageChangeRef.current = onPageChange;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  const measureSlots = useCallback(() => {
    const area = mode === 'scroll' ? scrollRef.current : pagedAreaRef.current;
    if (!area) return;
    const pad = mode === 'scroll' ? 24 : 32;
    const w = Math.max((area.clientWidth - pad) * scaleRef.current, 240);
    slotWRef.current = w;
    slotHRef.current = w * SLOT_RATIO + PAGE_GAP;
  }, [mode]);

  const notifyPage = useCallback((p: number) => {
    onPageChangeRef.current(p);
  }, []);

  const pageSrc = useCallback((index: number): string | undefined => {
    return metaRef.current?.srcs[index];
  }, []);

  const bindImg = useCallback(
    (img: HTMLImageElement, index: number) => {
      const src = pageSrc(index);
      if (!src) return;
      if (
        img.dataset.pageIndex === String(index) &&
        img.dataset.src === src &&
        img.complete &&
        img.naturalWidth > 0
      ) {
        return;
      }
      img.dataset.pageIndex = String(index);
      applyToImg(img, src);
    },
    [pageSrc]
  );

  const sizeImg = useCallback((img: HTMLImageElement) => {
    img.style.width = `${slotWRef.current}px`;
    img.style.height = `${slotWRef.current * SLOT_RATIO}px`;
  }, []);

  const acquirePageEl = useCallback(
    (index: number): HTMLElement => {
      let el = poolRef.current.get(index);
      if (!el) {
        el = document.createElement('div');
        el.className = 'reader-scroll-page';
        el.dataset.page = String(index + 1);
        const img = document.createElement('img');
        img.className = 'reader-img is-loading';
        img.decoding = 'async';
        img.alt = '';
        sizeImg(img);
        el.appendChild(img);
        poolRef.current.set(index, el);
      }
      el.style.height = `${slotHRef.current}px`;
      const img = el.firstElementChild as HTMLImageElement | null;
      if (img) sizeImg(img);
      return el;
    },
    [sizeImg]
  );

  const patchScrollWindow = useCallback(
    (start: number, end: number) => {
      const meta = metaRef.current;
      const host = scrollPagesRef.current;
      const top = scrollTopRef.current;
      const bottom = scrollBottomRef.current;
      if (!meta || !host || !top || !bottom) return;
      const prev = scrollWindowRef.current;
      if (prev.start === start && prev.end === end) return;
      scrollWindowRef.current = {start, end};
      const h = slotHRef.current;
      top.style.height = `${start * h}px`;
      bottom.style.height = `${Math.max(0, (meta.pageCount - end) * h)}px`;

      const active = pageElsRef.current;
      for (const [idx, el] of [...active.entries()]) {
        if (idx < start || idx >= end) {
          el.remove();
          active.delete(idx);
        }
      }
      let anchor: HTMLElement | null = null;
      for (let i = start; i < end; i++) {
        let el = active.get(i);
        if (!el) {
          el = acquirePageEl(i);
          active.set(i, el);
          if (anchor) {
            anchor.after(el);
          } else if (host.firstChild) {
            host.insertBefore(el, host.firstChild);
          } else {
            host.appendChild(el);
          }
          const img = el.firstElementChild as HTMLImageElement | null;
          if (img) bindImg(img, i);
        }
        anchor = el;
      }
    },
    [acquirePageEl, bindImg]
  );

  const ensureScrollWindow = useCallback(
    (cur: number, force = false) => {
      const meta = metaRef.current;
      if (!meta) return;
      const prev = scrollWindowRef.current;
      if (!force && prev.start >= 0) {
        const nearStart = cur - 1 <= prev.start + SCROLL_EDGE;
        const nearEnd = cur >= prev.end - SCROLL_EDGE;
        if (!nearStart && !nearEnd) return;
      }
      const wantStart = Math.max(0, cur - 1 - SCROLL_BACK);
      const wantEnd = Math.min(meta.pageCount, cur - 1 + SCROLL_FRONT + 1);
      let start = prev.start;
      let end = prev.end;
      if (force || start < 0) {
        start = wantStart;
        end = wantEnd;
      } else {
        if (cur - 1 <= start + SCROLL_EDGE) {
          start = Math.min(start, wantStart);
        }
        if (cur >= end - SCROLL_EDGE) {
          end = Math.max(end, wantEnd);
        }
        start = Math.max(0, start);
        end = Math.min(meta.pageCount, end);
        if (start === prev.start && end === prev.end) return;
      }
      patchScrollWindow(start, end);
    },
    [patchScrollWindow]
  );

  const scheduleWindowPatch = useCallback(
    (cur: number) => {
      pendingPageRef.current = cur;
      if (windowRafRef.current) return;
      windowRafRef.current = requestAnimationFrame(() => {
        windowRafRef.current = 0;
        ensureScrollWindow(pendingPageRef.current || pageRef.current);
      });
    },
    [ensureScrollWindow]
  );

  const onScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const area = scrollRef.current;
      const meta = metaRef.current;
      if (!area || !meta) return;
      const h = slotHRef.current || 1;
      let cur = clamp(Math.floor(area.scrollTop / h) + 1, 1, meta.pageCount);
      if (area.scrollTop + area.clientHeight >= area.scrollHeight - 2) {
        cur = meta.pageCount;
      }
      if (cur !== pageRef.current) {
        pageRef.current = cur;
        notifyPage(cur);
      }
      const win = scrollWindowRef.current;
      if (win.start < 0 || cur - 1 <= win.start + SCROLL_EDGE || cur >= win.end - SCROLL_EDGE) {
        scheduleWindowPatch(cur);
      }
    });
  }, [notifyPage, scheduleWindowPatch]);

  const setTrackX = useCallback((x: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${PAGED_FLIP_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
      : 'none';
    track.style.transform = `translate3d(${x}%, 0, 0)`;
  }, []);

  const paintPagedSlides = useCallback(
    (center: number) => {
      const meta = metaRef.current;
      if (!meta) return;
      const pages = [center - 1, center, center + 1];
      pages.forEach((page1, slot) => {
        const img = slideRefs.current[slot];
        if (!img) return;
        if (page1 < 1 || page1 > meta.pageCount) {
          img.removeAttribute('src');
          delete img.dataset.src;
          img.classList.remove('is-ready');
          img.classList.add('is-loading');
          img.style.visibility = 'hidden';
          return;
        }
        img.style.visibility = 'visible';
        sizeImg(img);
        bindImg(img, page1 - 1);
      });
    },
    [sizeImg, bindImg]
  );

  const flipPaged = useCallback(
    async (next: number) => {
      const meta = metaRef.current;
      if (!meta || animatingRef.current) return;
      const cur = pageRef.current;
      const target = clamp(next, 1, meta.pageCount);
      if (target === cur) return;
      const dir = target > cur ? 1 : -1;
      animatingRef.current = true;
      if (dir > 0) {
        const img = slideRefs.current[2];
        if (img) {
          sizeImg(img);
          bindImg(img, target - 1);
        }
        setTrackX(-66.6667, true);
      } else {
        const img = slideRefs.current[0];
        if (img) {
          sizeImg(img);
          bindImg(img, target - 1);
        }
        setTrackX(0, true);
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, PAGED_FLIP_MS + 16);
      });
      pageRef.current = target;
      notifyPage(target);
      setTrackX(-33.3333, false);
      paintPagedSlides(target);
      animatingRef.current = false;
    },
    [sizeImg, bindImg, setTrackX, notifyPage, paintPagedSlides]
  );

  const refreshSized = useCallback(() => {
    measureSlots();
    if (mode === 'scroll') {
      const h = slotHRef.current;
      const prev = scrollWindowRef.current;
      if (scrollTopRef.current && prev.start >= 0) {
        scrollTopRef.current.style.height = `${prev.start * h}px`;
      }
      if (scrollBottomRef.current && metaRef.current && prev.end >= 0) {
        scrollBottomRef.current.style.height = `${Math.max(0, (metaRef.current.pageCount - prev.end) * h)}px`;
      }
      pageElsRef.current.forEach((el) => {
        el.style.height = `${h}px`;
        const img = el.firstElementChild as HTMLImageElement | null;
        if (img) sizeImg(img);
      });
    } else {
      paintPagedSlides(pageRef.current);
    }
  }, [mode, measureSlots, sizeImg, paintPagedSlides]);

  const goTo = useCallback(
    (n: number) => {
      const meta = metaRef.current;
      if (!meta) return;
      const next = clamp(n, 1, Math.max(1, meta.pageCount));
      if (mode === 'scroll') {
        pageRef.current = next;
        notifyPage(next);
        const area = scrollRef.current;
        if (area) {
          area.scrollTo({top: (next - 1) * slotHRef.current, behavior: 'smooth'});
        }
        ensureScrollWindow(next, true);
      } else if (Math.abs(next - pageRef.current) === 1) {
        void flipPaged(next);
      } else {
        pageRef.current = next;
        notifyPage(next);
        setTrackX(-33.3333, false);
        paintPagedSlides(next);
      }
    },
    [mode, notifyPage, ensureScrollWindow, flipPaged, setTrackX, paintPagedSlides]
  );

  const zoom = useCallback(
    (factor: number) => {
      scaleRef.current = clamp(scaleRef.current * factor, SCALE_MIN, SCALE_MAX);
      refreshSized();
    },
    [refreshSized]
  );

  const fitToWidth = useCallback(() => {
    scaleRef.current = 1;
    refreshSized();
  }, [refreshSized]);

  useImperativeHandle(
    ref,
    () => ({
      goTo,
      zoom,
      fitToWidth,
    }),
    [goTo, zoom, fitToWidth]
  );

  useEffect(() => {
    let alive = true;
    const boot = (m: ImageDocMeta) => {
      metaRef.current = m;
      onReadyRef.current(m.pageCount);
      measureSlots();
      if (mode === 'scroll') {
        ensureScrollWindow(1, true);
      } else {
        setTrackX(-33.3333, false);
        paintPagedSlides(1);
      }
    };
    const cached = getImageDocMeta(pagesDir);
    if (cached) {
      boot(cached);
      return () => {
        alive = false;
      };
    }
    loadImageDocMeta(pagesDir)
      .then((m) => {
        if (!alive) return;
        boot(m);
      })
      .catch((e) => {
        if (alive) {
          onErrorRef.current(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      alive = false;
      if (windowRafRef.current) {
        cancelAnimationFrame(windowRafRef.current);
        windowRafRef.current = 0;
      }
      pageElsRef.current.clear();
      poolRef.current.clear();
      scrollPagesRef.current?.replaceChildren();
      scrollWindowRef.current = {start: -1, end: -1};
    };
  }, [pagesDir, mode, measureSlots, ensureScrollWindow, paintPagedSlides, setTrackX]);

  useEffect(() => {
    if (mode !== 'scroll') return;
    const area = scrollRef.current;
    if (!area) return;
    measureSlots();
    const ro = new ResizeObserver(() => {
      refreshSized();
      ensureScrollWindow(pageRef.current, true);
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, [mode, measureSlots, refreshSized, ensureScrollWindow]);

  useEffect(() => {
    if (mode !== 'paged') return;
    const area = pagedAreaRef.current;
    if (!area) return;
    const ro = new ResizeObserver(() => refreshSized());
    ro.observe(area);
    return () => ro.disconnect();
  }, [mode, refreshSized]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        ),
        scale: scaleRef.current,
      };
      touchRef.current = null;
    } else if (e.touches.length === 1) {
      touchRef.current = {x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now()};
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const p = pinchRef.current;
      if (p && e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        scaleRef.current = clamp(p.scale * (dist / p.dist), SCALE_MIN, SCALE_MAX);
        refreshSized();
        return;
      }
      if (mode === 'paged' && touchRef.current && e.touches.length === 1 && !animatingRef.current) {
        const dx = e.touches[0].clientX - touchRef.current.x;
        const dy = e.touches[0].clientY - touchRef.current.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          const meta = metaRef.current;
          const cur = pageRef.current;
          if (!meta) return;
          if ((dx < 0 && cur >= meta.pageCount) || (dx > 0 && cur <= 1)) return;
          const pct = (dx / (pagedAreaRef.current?.clientWidth || 1)) * 100;
          setTrackX(-33.3333 + pct, false);
        }
      }
    },
    [mode, refreshSized, setTrackX]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      pinchRef.current = null;
      const t = touchRef.current;
      touchRef.current = null;
      if (!t || mode !== 'paged' || animatingRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - t.x;
      const dy = touch.clientY - t.y;
      const dt = Math.max(1, Date.now() - t.t);
      const velocity = Math.abs(dx) / dt;
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > SWIPE_MIN || velocity > 0.4)) {
        void flipPaged(dx < 0 ? pageRef.current + 1 : pageRef.current - 1);
      } else {
        setTrackX(-33.3333, true);
      }
    },
    [mode, flipPaged, setTrackX]
  );

  if (mode === 'scroll') {
    return (
      <div
        className="reader-scroll-area reader-img-area"
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="reader-scroll-content">
          <div className="reader-scroll-spacer" ref={scrollTopRef} />
          <div className="reader-scroll-pages" ref={scrollPagesRef} />
          <div className="reader-scroll-spacer" ref={scrollBottomRef} />
        </div>
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
      <div className="reader-paged-track" ref={trackRef}>
        {[0, 1, 2].map((slot) => (
          <div className="reader-paged-slide" key={slot}>
            <img
              ref={(el) => {
                slideRefs.current[slot] = el;
              }}
              className="reader-img reader-img-paged is-loading"
              alt=""
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
});

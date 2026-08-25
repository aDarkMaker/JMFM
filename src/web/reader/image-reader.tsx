import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';
import {clamp, SCALE_MAX, SCALE_MIN} from './types';
import {getImageDocMeta, loadImageDocMeta, ImageDocMeta} from './image-doc';

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

const PAGE_GAP = 12;
const SLOT_RATIO = 4 / 3;
const SCROLL_BACK = 1;
const SCROLL_FRONT = 3;
const SCROLL_HYSTERESIS = 1;
const DECODE_AHEAD = 4;
const DECODE_CONCURRENCY = 2;
const PREWARM_PAGES = 12;
const TOOLBAR_THROTTLE_MS = 250;
const PAGED_FLIP_MS = 200;
const SWIPE_MIN = 48;

export const ImageReader = forwardRef<ImageReaderHandle, ImageReaderProps>(function ImageReader(
  {pagesDir, mode, onPageChange, onReady, onError},
  ref,
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
  const scrollWindowRef = useRef({start: -1, end: -1});
  const scrollRafRef = useRef(0);
  const toolbarTimerRef = useRef(0);
  const decodedRef = useRef(new Set<number>());
  const decodingRef = useRef(new Set<number>());
  const decodeQueueRef = useRef<number[]>([]);
  const decodeActiveRef = useRef(0);
  const pagedAreaRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<[HTMLImageElement | null, HTMLImageElement | null, HTMLImageElement | null]>([
    null,
    null,
    null,
  ]);
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
    if (toolbarTimerRef.current) return;
    toolbarTimerRef.current = window.setTimeout(() => {
      toolbarTimerRef.current = 0;
    }, TOOLBAR_THROTTLE_MS);
    onPageChangeRef.current(p);
  }, []);

  const pumpDecode = useCallback(() => {
    const meta = metaRef.current;
    if (!meta) return;
    while (decodeActiveRef.current < DECODE_CONCURRENCY && decodeQueueRef.current.length > 0) {
      const index = decodeQueueRef.current.shift()!;
      if (decodedRef.current.has(index) || decodingRef.current.has(index)) continue;
      const src = meta.srcs[index];
      if (!src) continue;
      decodingRef.current.add(index);
      decodeActiveRef.current += 1;
      const img = new Image();
      img.decoding = 'async';
      const done = () => {
        decodingRef.current.delete(index);
        decodedRef.current.add(index);
        decodeActiveRef.current -= 1;
        pumpDecode();
      };
      img.onload = done;
      img.onerror = done;
      img.src = src;
    }
  }, []);

  const enqueueDecode = useCallback(
    (indices: number[], priority = false) => {
      const meta = metaRef.current;
      if (!meta) return;
      const add: number[] = [];
      for (const i of indices) {
        if (i < 0 || i >= meta.pageCount) continue;
        if (decodedRef.current.has(i) || decodingRef.current.has(i)) continue;
        if (!meta.srcs[i]) continue;
        if (decodeQueueRef.current.includes(i)) continue;
        add.push(i);
      }
      if (add.length === 0) return;
      if (priority) {
        decodeQueueRef.current = [...add, ...decodeQueueRef.current];
      } else {
        decodeQueueRef.current.push(...add);
      }
      pumpDecode();
    },
    [pumpDecode],
  );

  const setImgSrc = useCallback((img: HTMLImageElement, index: number) => {
    const meta = metaRef.current;
    if (!meta) return;
    const src = meta.srcs[index];
    if (!src) return;
    if (img.getAttribute('src') === src) return;
    img.src = src;
  }, []);

  const sizeImg = useCallback((img: HTMLImageElement) => {
    img.style.width = `${slotWRef.current}px`;
    img.style.height = `${slotWRef.current * SLOT_RATIO}px`;
  }, []);

  const makePageEl = useCallback(
    (index: number): HTMLElement => {
      const wrap = document.createElement('div');
      wrap.className = 'reader-scroll-page';
      wrap.dataset.page = String(index + 1);
      wrap.style.height = `${slotHRef.current}px`;
      const img = document.createElement('img');
      img.className = 'reader-img';
      img.decoding = 'async';
      img.alt = '';
      sizeImg(img);
      setImgSrc(img, index);
      wrap.appendChild(img);
      return wrap;
    },
    [sizeImg, setImgSrc],
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

      const map = pageElsRef.current;
      for (const [idx, el] of [...map.entries()]) {
        if (idx < start || idx >= end) {
          el.remove();
          map.delete(idx);
        }
      }
      let anchor: HTMLElement | null = null;
      for (let i = start; i < end; i++) {
        let el = map.get(i);
        if (!el) {
          el = makePageEl(i);
          map.set(i, el);
          if (anchor) {
            anchor.after(el);
          } else if (host.firstChild) {
            host.insertBefore(el, host.firstChild);
          } else {
            host.appendChild(el);
          }
        } else {
          el.style.height = `${h}px`;
          const img = el.firstElementChild as HTMLImageElement | null;
          if (img) {
            sizeImg(img);
            setImgSrc(img, i);
          }
        }
        anchor = el;
      }
      enqueueDecode(Array.from({length: end - start}, (_, k) => start + k), true);
      enqueueDecode(
        Array.from({length: DECODE_AHEAD}, (_, k) => end + k).filter(i => i < meta.pageCount),
      );
    },
    [makePageEl, sizeImg, setImgSrc, enqueueDecode],
  );

  const ensureScrollWindow = useCallback(
    (cur: number, force = false) => {
      const meta = metaRef.current;
      if (!meta) return;
      const prev = scrollWindowRef.current;
      const wantStart = Math.max(0, cur - 1 - SCROLL_BACK);
      const wantEnd = Math.min(meta.pageCount, cur - 1 + SCROLL_FRONT + 1);
      let start = prev.start;
      let end = prev.end;
      if (force || start < 0) {
        start = wantStart;
        end = wantEnd;
      } else {
        if (cur - 1 - SCROLL_HYSTERESIS < start) start = wantStart;
        if (cur - 1 + SCROLL_HYSTERESIS >= end - 1) end = wantEnd;
        start = Math.max(0, Math.min(start, wantStart));
        end = Math.min(meta.pageCount, Math.max(end, wantEnd));
        if (start === prev.start && end === prev.end) {
          enqueueDecode(
            Array.from({length: DECODE_AHEAD}, (_, k) => cur - 1 + SCROLL_FRONT + 1 + k),
          );
          return;
        }
      }
      patchScrollWindow(start, end);
    },
    [patchScrollWindow, enqueueDecode],
  );

  const onScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const area = scrollRef.current;
      const meta = metaRef.current;
      if (!area || !meta) return;
      const h = slotHRef.current || 1;
      const cur = clamp(Math.floor(area.scrollTop / h) + 1, 1, meta.pageCount);
      if (cur !== pageRef.current) {
        pageRef.current = cur;
        notifyPage(cur);
      }
      ensureScrollWindow(cur);
    });
  }, [notifyPage, ensureScrollWindow]);

  const setTrackX = useCallback((x: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate ? `transform ${PAGED_FLIP_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none';
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
          img.style.visibility = 'hidden';
          return;
        }
        img.style.visibility = 'visible';
        sizeImg(img);
        setImgSrc(img, page1 - 1);
      });
      enqueueDecode([center - 1, center, center + 1, center + 2].map(p => p - 1), true);
    },
    [sizeImg, setImgSrc, enqueueDecode],
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
          setImgSrc(img, target - 1);
        }
        setTrackX(-66.6667, true);
      } else {
        const img = slideRefs.current[0];
        if (img) {
          sizeImg(img);
          setImgSrc(img, target - 1);
        }
        setTrackX(0, true);
      }
      await new Promise<void>(resolve => {
        window.setTimeout(resolve, PAGED_FLIP_MS + 16);
      });
      pageRef.current = target;
      notifyPage(target);
      setTrackX(-33.3333, false);
      paintPagedSlides(target);
      animatingRef.current = false;
    },
    [sizeImg, setImgSrc, setTrackX, notifyPage, paintPagedSlides],
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
      pageElsRef.current.forEach((el, idx) => {
        el.style.height = `${h}px`;
        const img = el.firstElementChild as HTMLImageElement | null;
        if (img) {
          sizeImg(img);
          setImgSrc(img, idx);
        }
      });
    } else {
      paintPagedSlides(pageRef.current);
    }
  }, [mode, measureSlots, sizeImg, setImgSrc, paintPagedSlides]);

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
    [mode, notifyPage, ensureScrollWindow, flipPaged, setTrackX, paintPagedSlides],
  );

  const zoom = useCallback(
    (factor: number) => {
      scaleRef.current = clamp(scaleRef.current * factor, SCALE_MIN, SCALE_MAX);
      refreshSized();
    },
    [refreshSized],
  );

  const fitToWidth = useCallback(() => {
    scaleRef.current = 1;
    refreshSized();
  }, [refreshSized]);

  useImperativeHandle(ref, () => ({
    goTo,
    zoom,
    fitToWidth,
    getPage: () => pageRef.current,
  }), [goTo, zoom, fitToWidth]);

  useEffect(() => {
    let alive = true;
    let idleId = 0;
    const schedulePrewarm = (m: ImageDocMeta) => {
      const warm = Array.from({length: Math.min(PREWARM_PAGES, m.pageCount)}, (_, i) => i);
      const run = () => {
        if (!alive) return;
        enqueueDecode(warm);
      };
      const ric = (window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: {timeout: number}) => number;
      }).requestIdleCallback;
      if (typeof ric === 'function') {
        idleId = ric(run, {timeout: 400});
      } else {
        idleId = window.setTimeout(run, 32) as unknown as number;
      }
    };
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
      schedulePrewarm(m);
    };
    const cached = getImageDocMeta(pagesDir);
    if (cached) {
      boot(cached);
      return () => {
        alive = false;
        if (idleId) {
          const cic = (window as Window & {cancelIdleCallback?: (id: number) => void}).cancelIdleCallback;
          if (typeof cic === 'function') cic(idleId);
          else clearTimeout(idleId);
        }
      };
    }
    loadImageDocMeta(pagesDir)
      .then(m => {
        if (!alive) return;
        boot(m);
      })
      .catch(e => {
        if (alive) {
          onErrorRef.current(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      alive = false;
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
      if (idleId) {
        const cic = (window as Window & {cancelIdleCallback?: (id: number) => void}).cancelIdleCallback;
        if (typeof cic === 'function') cic(idleId);
        else clearTimeout(idleId);
      }
      pageElsRef.current.clear();
      scrollPagesRef.current?.replaceChildren();
      scrollWindowRef.current = {start: -1, end: -1};
      decodeQueueRef.current = [];
      decodingRef.current.clear();
    };
  }, [pagesDir, mode, measureSlots, ensureScrollWindow, paintPagedSlides, setTrackX, enqueueDecode]);

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
        dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
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
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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
    [mode, refreshSized, setTrackX],
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
    [mode, flipPaged, setTrackX],
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
        {[0, 1, 2].map(slot => (
          <div className="reader-paged-slide" key={slot}>
            <img
              ref={el => {
                slideRefs.current[slot] = el;
              }}
              className="reader-img reader-img-paged"
              alt=""
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
});

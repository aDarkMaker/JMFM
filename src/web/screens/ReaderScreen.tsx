import {useCallback, useEffect, useRef, useState} from 'react';
import {Icon} from '../components/Icon';
import {useSettingsStore} from '../stores/settings';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {clamp, ReaderTarget, SCALE_MAX, SCALE_MIN, TouchState} from '../reader/types';
import {getDocCache, loadDoc, persistCacheEntry, setPageContent} from '../reader/pdf-doc';
import {ImageReader, ImageReaderHandle} from '../reader/image-reader';
import * as paged from '../reader/paged-viewer';
import * as scroll from '../reader/scroll-viewer';
import {useTouchGestures} from '../reader/useTouchGestures';

pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

export type {ReaderTarget} from '../reader/types';

export function ReaderScreen({
  target,
  onClose,
  closing = false,
}: {
  target: ReaderTarget;
  onClose: () => void;
  closing?: boolean;
}) {
  const readerMode = useSettingsStore(s => s.settings.readerMode);
  const isScroll = readerMode === 'scroll';
  const isImageMode = target.pagesDir != null;
  const cachedEntry = useRef(getDocCache(target.filePath)).current;
  const initialPages = target.pageCount ?? cachedEntry?.numPages ?? 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const pagedAreaRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const pageCanvasesRef = useRef<(HTMLCanvasElement | null)[]>([]);
  const [page, setPage] = useState(cachedEntry?.page ?? 1);
  const [pages, setPages] = useState(initialPages);
  const pagesRef = useRef(initialPages);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(cachedEntry?.doc ?? null);
  const pageNumRef = useRef(cachedEntry?.page ?? 1);
  const scaleRef = useRef(cachedEntry?.scale ?? 1.2);
  const renderedScaleRef = useRef(cachedEntry?.scale ?? 1.2);
  const currentScrollPageRef = useRef(1);
  const renderedScrollPagesRef = useRef<Set<number>>(new Set());
  const touchStateRef = useRef<TouchState>(null);
  const rafRef = useRef(0);
  const animatingRef = useRef(false);
  const renderSeqRef = useRef(0);
  const backPageRef = useRef<{page: number; scale: number} | null>(null);
  const suppressScrollRef = useRef(false);
  const scrollRenderingRef = useRef(false);
  const scrollDirtyRef = useRef(false);
  const pendingFlipRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const imageReaderRef = useRef<ImageReaderHandle | null>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncImageToolbarPage = useCallback((p: number) => {
    pageNumRef.current = p;
    const input = pageInputRef.current;
    if (input && document.activeElement !== input) {
      input.value = String(p);
    }
    if (prevBtnRef.current) {
      prevBtnRef.current.disabled = p <= 1;
    }
    if (nextBtnRef.current) {
      nextBtnRef.current.disabled = pagesRef.current > 0 && p >= pagesRef.current;
    }
  }, []);

  const pagedCtx: paged.PagedViewerCtx = {
    pagedAreaRef,
    frontRef,
    backRef,
    docRef,
    pageNumRef,
    scaleRef,
    renderedScaleRef,
    renderSeqRef,
    backPageRef,
    animatingRef,
    mountedRef,
    setError,
    setPage,
  };

  const scrollCtx: scroll.ScrollViewerCtx = {
    scrollAreaRef,
    scrollContentRef,
    pageCanvasesRef,
    docRef,
    pagesRef,
    pageNumRef,
    scaleRef,
    renderedScaleRef,
    currentScrollPageRef,
    renderedScrollPagesRef,
    renderSeqRef,
    suppressScrollRef,
    setPage,
  };

  useEffect(() => {
    let alive = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    animatingRef.current = false;
    renderSeqRef.current++;
    renderedScrollPagesRef.current.clear();
    backPageRef.current = null;
    currentScrollPageRef.current = 1;
    setError(null);

    if (isImageMode) {
      if (target.pageCount) {
        setPages(target.pageCount);
        pagesRef.current = target.pageCount;
      }
      return () => {
        alive = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      };
    }

    (async () => {
      try {
        const entry = await loadDoc(target.filePath);
        if (!alive) return;
        docRef.current = entry.doc;
        pageNumRef.current = entry.page;
        scaleRef.current = entry.scale;
        renderedScaleRef.current = entry.scale;
        setPages(entry.numPages);
        pagesRef.current = entry.numPages;
        setPage(entry.page);
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      alive = false;
      persistCacheEntry(target.filePath, docRef.current, pageNumRef.current, scaleRef.current);
      docRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [target]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc || error) return;
    if (pages === 0) return;
    if (isScroll) {
      const area = scrollAreaRef.current;
      void scroll.renderAllPages(scrollCtx, true).then(() => {
        if (!mountedRef.current) return;
        const canvas = pageCanvasesRef.current[pageNumRef.current - 1];
        if (area && canvas) {
          area.scrollTop = canvas.offsetTop - 8;
        }
        currentScrollPageRef.current = pageNumRef.current;
      });
      return;
    }
    const canvas = frontRef.current;
    const back = backRef.current;
    if (!canvas || !back) return;
    const seq = renderSeqRef.current;
    (async () => {
      try {
        const pdfPage = await doc.getPage(pageNumRef.current);
        if (seq !== renderSeqRef.current) return;
        const vp = pdfPage.getViewport({scale: 1});
        const area = pagedAreaRef.current;
        scaleRef.current = Math.max(((area?.clientWidth ?? 320) - 32) / vp.width, SCALE_MIN);
        renderedScaleRef.current = scaleRef.current;
        await setPageContent(
          canvas,
          doc,
          pageNumRef.current,
          scaleRef.current,
          seq,
          () => renderSeqRef.current,
        );
        paged.positionCanvas(area, canvas);
        back.style.visibility = 'hidden';
        requestAnimationFrame(() => void paged.prefetchNext(pagedCtx, pageNumRef.current));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [pages, isScroll, error]);

  const onScrollAreaScroll = useCallback(() => {
    scroll.onScrollAreaScroll(scrollCtx);
    if (scrollRenderingRef.current) {
      scrollDirtyRef.current = true;
      return;
    }
    scrollRenderingRef.current = true;
    void scroll
      .renderScrollWindow(scrollCtx, scroll.getScrollPage(scrollCtx), renderSeqRef.current)
      .finally(() => {
        scrollRenderingRef.current = false;
        if (scrollDirtyRef.current) {
          scrollDirtyRef.current = false;
          onScrollAreaScroll();
        }
      });
  }, [scrollCtx]);

  function flip(n: number) {
    const dir = n > pageNumRef.current ? 1 : -1;
    void paged.flipPaged(pagedCtx, n, dir).then(() => {
      const next = pendingFlipRef.current;
      pendingFlipRef.current = null;
      if (next != null && next !== pageNumRef.current) {
        flip(next);
      }
    });
  }

  function goTo(next: number) {
    if (isImageMode) {
      imageReaderRef.current?.goTo(next);
      return;
    }
    const n = clamp(next, 1, pages);
    if (n === pageNumRef.current) return;
    if (isScroll) {
      pageNumRef.current = n;
      setPage(n);
      scroll.scrollToPage(scrollCtx, n);
      return;
    }
    pendingFlipRef.current = n;
    if (!animatingRef.current) {
      pendingFlipRef.current = null;
      flip(n);
    }
  }

  function zoom(factor: number) {
    if (isImageMode) {
      imageReaderRef.current?.zoom(factor);
      return;
    }
    scaleRef.current = clamp(scaleRef.current * factor, SCALE_MIN, SCALE_MAX);
    if (isScroll) {
      scroll.scaleScrollWithAnchor(scrollCtx, fn => scroll.renderAllPages(scrollCtx, false, fn));
    } else {
      void paged.reRenderPaged(pagedCtx);
    }
  }

  const fitToWidth = useCallback(async () => {
    if (isImageMode) {
      imageReaderRef.current?.fitToWidth();
      return;
    }
    if (isScroll) {
      scroll.scaleScrollWithAnchor(scrollCtx, fn => scroll.renderAllPages(scrollCtx, true, fn));
      return;
    }
    const doc = docRef.current;
    const area = pagedAreaRef.current;
    if (!doc || !area) return;
    const pdfPage = await doc.getPage(pageNumRef.current);
    const vp = pdfPage.getViewport({scale: 1});
    scaleRef.current = Math.max((area.clientWidth - 32) / vp.width, SCALE_MIN);
    await paged.reRenderPaged(pagedCtx);
  }, [isImageMode, isScroll, scrollCtx, pagedCtx]);

  const handleImageReady = useCallback(
    (total: number) => {
      setPages(total);
      pagesRef.current = total;
      syncImageToolbarPage(pageNumRef.current);
    },
    [syncImageToolbarPage],
  );

  const handleImagePageChange = useCallback(
    (p: number) => {
      syncImageToolbarPage(p);
    },
    [syncImageToolbarPage],
  );

  const handleImageError = useCallback((e: string | null) => {
    setError(e);
  }, []);

  const gestureEl = !isImageMode ? (isScroll ? scrollAreaRef.current : pagedAreaRef.current) : null;
  const gestureCtx = {
    ...pagedCtx,
    ...scrollCtx,
    isScroll,
    touchStateRef,
    rafRef,
    goTo,
  };
  useTouchGestures(gestureCtx, gestureEl);

  const rootClass = `reader-screen${closing ? ' is-closing' : ''}`;

  return (
    <div className={rootClass}>
      <div className="reader-toolbar">
        <button className="reader-btn" onClick={onClose} aria-label="返回">
          <Icon name="arrow-back" size={20} />
        </button>
        <span className="reader-title">{target.title}</span>
        <div className="reader-toolbar-group">
          <button
            ref={prevBtnRef}
            className="reader-btn"
            onClick={() => goTo((isImageMode ? pageNumRef.current : page) - 1)}
            disabled={(isImageMode ? pageNumRef.current : page) <= 1}
            aria-label="上一页"
          >
            <Icon name="chevron-right" size={20} style={{transform: 'rotate(180deg)'}} />
          </button>
          {isImageMode ? (
            <input
              ref={pageInputRef}
              className="reader-page-input"
              type="text"
              inputMode="numeric"
              defaultValue={page}
              onChange={e => {
                const v = Number(e.target.value.replace(/\D/g, ''));
                if (v >= 1) {
                  goTo(v);
                }
              }}
            />
          ) : (
            <input
              className="reader-page-input"
              type="text"
              inputMode="numeric"
              value={page}
              onChange={e => {
                const v = Number(e.target.value.replace(/\D/g, ''));
                if (v >= 1) {
                  goTo(v);
                }
              }}
            />
          )}
          <span className="reader-total">/ {pages || '-'}</span>
          <button
            ref={nextBtnRef}
            className="reader-btn"
            onClick={() => goTo((isImageMode ? pageNumRef.current : page) + 1)}
            disabled={(isImageMode ? pageNumRef.current : page) >= pages}
            aria-label="下一页"
          >
            <Icon name="chevron-right" size={20} />
          </button>
        </div>
        <div className="reader-toolbar-group">
          <button className="reader-btn" onClick={() => zoom(0.8)} aria-label="缩小">
            <Icon name="zoom-out" size={18} />
          </button>
          <button className="reader-btn" onClick={() => zoom(1.25)} aria-label="放大">
            <Icon name="zoom-in" size={18} />
          </button>
          <button className="reader-btn" onClick={() => void fitToWidth()}>
            适应宽度
          </button>
        </div>
      </div>
      {isImageMode ? (
        <ImageReader
          ref={imageReaderRef}
          pagesDir={target.pagesDir!}
          pageCount={target.pageCount}
          mode={isScroll ? 'scroll' : 'paged'}
          onPageChange={handleImagePageChange}
          onReady={handleImageReady}
          onError={handleImageError}
        />
      ) : isScroll ? (
        <div className="reader-scroll-area" ref={scrollAreaRef} onScroll={onScrollAreaScroll}>
          {pages > 0 ? (
            <div className="reader-scroll-content" ref={scrollContentRef}>
              {Array.from({length: pages}).map((_, i) => (
                <div className="reader-scroll-page" key={i}>
                  <canvas
                    ref={el => {
                      pageCanvasesRef.current[i] = el;
                    }}
                    className="reader-canvas"
                  />
                </div>
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="reader-error">无法打开 PDF：{error}</div>
          ) : null}
        </div>
      ) : (
        <div className="reader-paged-area" ref={pagedAreaRef}>
          {pages > 0 ? (
            <>
              <canvas ref={frontRef} className="reader-canvas reader-canvas-paged" />
              <canvas ref={backRef} className="reader-canvas reader-canvas-paged" style={{visibility: 'hidden'}} />
            </>
          ) : null}
          {error ? (
            <div className="reader-error">无法打开 PDF：{error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

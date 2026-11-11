import {useCallback, useEffect, useRef, useState} from 'react';
import {useSettingsStore} from '@/web/stores/settings';
import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {ReaderTarget, TouchState} from '@/web/reader/types';
import {clamp, SCALE_MAX, SCALE_MIN} from '@/web/reader/types';
import {getDocCache, loadDoc, persistCacheEntry, setPageContent} from '@/web/reader/pdf-doc';
import type {ImageReaderHandle} from '@/web/reader/image-reader';
import {ImageReader} from '@/web/reader/image-reader';
import * as paged from '@/web/reader/paged-viewer';
import * as scroll from '@/web/reader/scroll-viewer';
import {useTouchGestures} from '@/web/reader/useTouchGestures';
import {useHistoryStore} from '@/web/stores/history';
import {ReaderToolbar} from './ReaderToolbar';
import {ReaderStatus} from './ReaderStatus';
import styles from './reader.module.css';
import '@/web/reader/engine.css';

export type {ReaderTarget} from '@/web/reader/types';

export function ReaderScreen({
  target,
  onClose,
  closing = false,
}: {
  target: ReaderTarget;
  onClose: () => void;
  closing?: boolean;
}) {
  const readerMode = useSettingsStore((s) => s.settings.readerMode);
  const isScroll = readerMode === 'scroll';
  const isImageMode = target.pagesDir != null || target.online != null;
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
  const [reloadKey, setReloadKey] = useState(0);
  const [pageInput, setPageInput] = useState(String(cachedEntry?.page ?? 1));
  const docRef = useRef<PDFDocumentProxy | null>(cachedEntry?.doc ?? null);
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
  const pageInputWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncImageToolbarPage = useCallback((p: number) => {
    pageNumRef.current = p;
    setPageInput(String(p));
  }, []);

  const recordProgress = useCallback(
    (p: number) => {
      if (!target.albumId) return;
      const total = pagesRef.current;
      if (total <= 0) return;
      useHistoryStore.getState().record({
        albumId: target.albumId,
        title: target.title,
        ...(target.photoId != null ? {photoId: target.photoId} : {}),
        ...(target.chapterSort != null ? {chapterSort: target.chapterSort} : {}),
        page: p,
        total,
      });
    },
    [target.albumId, target.title, target.photoId, target.chapterSort]
  );

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
  }, [target, reloadKey, isImageMode]);

  useEffect(() => {
    if (isImageMode) return;
    if (document.activeElement !== pageInputWrapRef.current?.querySelector('input')) {
      setPageInput(String(page));
    }
  }, [page, isImageMode]);

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
          () => renderSeqRef.current
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
    recordProgress(n);
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
      scroll.scaleScrollWithAnchor(scrollCtx, (fn) => scroll.renderAllPages(scrollCtx, false, fn));
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
      scroll.scaleScrollWithAnchor(scrollCtx, (fn) => scroll.renderAllPages(scrollCtx, true, fn));
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

  const handlePageInputChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, '');
      setPageInput(digits);
      const v = Number(digits);
      if (v >= 1) {
        goTo(v);
      }
    },
    [goTo]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const handleImageReady = useCallback(
    (total: number) => {
      setPages(total);
      pagesRef.current = total;
      syncImageToolbarPage(pageNumRef.current);
    },
    [syncImageToolbarPage]
  );

  const handleImagePageChange = useCallback(
    (p: number) => {
      syncImageToolbarPage(p);
      recordProgress(p);
    },
    [syncImageToolbarPage, recordProgress]
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

  const current = isImageMode ? pageNumRef.current : page;

  return (
    <div className={[styles.screen, closing ? styles.closing : ''].filter(Boolean).join(' ')}>
      <ReaderToolbar
        title={target.title}
        page={current}
        total={pages}
        pageInput={pageInput}
        inputWrapRef={pageInputWrapRef}
        onClose={onClose}
        onPageInput={handlePageInputChange}
        onPrev={() => goTo(current - 1)}
        onNext={() => goTo(current + 1)}
        onZoomOut={() => zoom(0.8)}
        onZoomIn={() => zoom(1.25)}
        onFit={() => void fitToWidth()}
      />
      {isImageMode ? (
        <ImageReader
          ref={imageReaderRef}
          pagesDir={target.pagesDir}
          online={target.online}
          pageCount={target.pageCount}
          startPage={target.startPage}
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
                    ref={(el) => {
                      pageCanvasesRef.current[i] = el;
                    }}
                    className={styles.canvas}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <ReaderStatus error={error} pages={pages} onRetry={handleRetry} />
        </div>
      ) : (
        <div className={styles.pagedArea} ref={pagedAreaRef}>
          {pages > 0 ? (
            <>
              <canvas ref={frontRef} className={[styles.canvas, styles.canvasPaged].join(' ')} />
              <canvas
                ref={backRef}
                className={[styles.canvas, styles.canvasPaged].join(' ')}
                style={{visibility: 'hidden'}}
              />
            </>
          ) : null}
          <ReaderStatus error={error} pages={pages} onRetry={handleRetry} />
        </div>
      )}
    </div>
  );
}

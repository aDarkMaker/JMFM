/** Reader screen shell: toolbar + image reader + error/loading overlays. */
import {useCallback, useEffect, useRef, useState} from 'react';
import {useSettingsStore} from '@/web/stores/settings';
import type {ReaderTarget} from '@/web/reader/types';
import type {ImageReaderHandle} from '@/web/reader/image-reader';
import {ImageReader} from '@/web/reader/image-reader';
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
  const initialPages = target.pageCount ?? 0;
  const [page, setPage] = useState(target.startPage ?? 1);
  const [pages, setPages] = useState(initialPages);
  const pagesRef = useRef(initialPages);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pageInput, setPageInput] = useState(String(target.startPage ?? 1));
  const pageNumRef = useRef(target.startPage ?? 1);
  const imageReaderRef = useRef<ImageReaderHandle | null>(null);
  const pageInputWrapRef = useRef<HTMLDivElement>(null);

  const syncToolbarPage = useCallback((p: number) => {
    pageNumRef.current = p;
    setPage(p);
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

  useEffect(() => {
    setError(null);
    if (target.pageCount) {
      setPages(target.pageCount);
      pagesRef.current = target.pageCount;
    }
  }, [target, reloadKey]);

  const goTo = useCallback((next: number) => {
    imageReaderRef.current?.goTo(next);
  }, []);

  const zoom = useCallback((factor: number) => {
    imageReaderRef.current?.zoom(factor);
  }, []);

  const fitToWidth = useCallback(() => {
    imageReaderRef.current?.fitToWidth();
  }, []);

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
      syncToolbarPage(pageNumRef.current);
    },
    [syncToolbarPage]
  );

  const handleImagePageChange = useCallback(
    (p: number) => {
      syncToolbarPage(p);
      recordProgress(p);
    },
    [syncToolbarPage, recordProgress]
  );

  const handleImageError = useCallback((e: string | null) => {
    setError(e);
  }, []);

  return (
    <div className={[styles.screen, closing ? styles.closing : ''].filter(Boolean).join(' ')}>
      <ReaderToolbar
        title={target.title}
        page={page}
        total={pages}
        pageInput={pageInput}
        inputWrapRef={pageInputWrapRef}
        onClose={onClose}
        onPageInput={handlePageInputChange}
        onPrev={() => goTo(pageNumRef.current - 1)}
        onNext={() => goTo(pageNumRef.current + 1)}
        onZoomOut={() => zoom(0.8)}
        onZoomIn={() => zoom(1.25)}
        onFit={fitToWidth}
      />
      <div className={styles.body}>
        <ImageReader
          key={reloadKey}
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
        <ReaderStatus error={error} pages={pages} onRetry={handleRetry} />
      </div>
    </div>
  );
}

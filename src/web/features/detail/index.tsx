import {t} from '@/web/i18n';
import {useEffect, useMemo} from 'react';
import type {AlbumSummary} from '@/core/model';
import {useAlbumDetailStore} from '@/web/stores/albumDetail';
import {useHistoryStore} from '@/web/stores/history';
import {useLibraryStore} from '@/web/stores/library';
import {useDownloadStore} from '@/web/stores/download';
import {useSettingsStore} from '@/web/stores/settings';
import {useDownloadTask} from '@/web/hooks/useDownloadTask';
import {useNavStack} from '@/web/hooks/useNavStack';
import {EmptyState} from '@/web/ui/EmptyState';
import {Button} from '@/web/ui/Button';
import {NavBar} from '@/web/ui/NavBar';
import {AlbumDetailSkeleton} from '@/web/shared/Skeletons';
import {isBlockedAlbum} from '@/core/model/blocklist';
import {showToast} from '@/web/ui/Toast';
import type {ReaderTarget} from '@/web/reader/types';
import {DetailHero, DetailActions} from './DetailHero';
import {DetailTags, DetailDesc} from './DetailMeta';
import {DetailChapters, DetailRelated} from './DetailSections';
import styles from './detail.module.css';

export function AlbumDetailScreen({
  albumId,
  fallbackTitle,
  onOpenReader,
}: {
  albumId: number;
  fallbackTitle?: string;
  onOpenReader: (target: ReaderTarget) => void;
}) {
  const {back, pushDetail, pushSearch} = useNavStack();
  const entry = useAlbumDetailStore((s) => s.cache[String(albumId)]);
  const error = useAlbumDetailStore((s) => s.errors[String(albumId)]);
  const load = useAlbumDetailStore((s) => s.load);
  const history = useHistoryStore((s) => s.entries[String(albumId)]);
  const libraryItems = useLibraryStore((s) => s.items);
  const downloading = useDownloadStore((s) => s.tasks.some((t) => t.albumId === albumId));
  const blacklistTags = useSettingsStore((s) => s.settings.blacklistTags);
  const {enqueueAlbum} = useDownloadTask();

  useEffect(() => {
    // Legacy cache entries omit authors/works/actors — force a fresh /album parse.
    const hit = useAlbumDetailStore.getState().cache[String(albumId)];
    const stale =
      hit != null &&
      (!Array.isArray(hit.detail.authors) ||
        !Array.isArray(hit.detail.works) ||
        !Array.isArray(hit.detail.actors));
    void load(albumId, stale);
  }, [albumId, load]);

  const detail = entry?.detail;
  const libraryItem = useMemo(
    () => libraryItems.find((i) => i.albumId === albumId),
    [libraryItems, albumId]
  );
  const resumePage = history?.page ?? 1;
  const resumeSort = history?.chapterSort;

  const openLocal = (chapterSort?: number, startPage?: number) => {
    if (!detail || !libraryItem?.pagesDir) return;
    onOpenReader({
      filePath: libraryItem.filePath,
      title: detail.name,
      pageCount: libraryItem.pageCount,
      pagesDir: libraryItem.pagesDir,
      albumId: detail.albumId,
      ...(chapterSort != null ? {chapterSort} : {}),
      ...(startPage != null ? {startPage} : {}),
    });
  };

  const openOnline = (chapterSort?: number, startPage?: number) => {
    if (!detail) return;
    const ep =
      (chapterSort != null
        ? detail.episodes.find((e) => e.sort === chapterSort)
        : undefined) ?? detail.episodes[0];
    if (!ep) return;
    onOpenReader({
      filePath: `online://${detail.albumId}/${ep.photoId}`,
      title: detail.name,
      albumId: detail.albumId,
      photoId: ep.photoId,
      chapterSort: ep.sort,
      online: {albumId: detail.albumId, photoId: ep.photoId, scrambleId: detail.scrambleId},
      ...(startPage != null ? {startPage} : {}),
    });
  };

  const openChapter = (chapterSort: number, startPage?: number) => {
    if (!detail) return;
    if (libraryItem?.pagesDir) {
      openLocal(chapterSort, startPage);
      return;
    }
    openOnline(chapterSort, startPage);
  };

  const onRequestDownload = () => {
    if (!detail || downloading || libraryItem != null) return;
    if (isBlockedAlbum({tags: detail.tags} as AlbumSummary, blacklistTags)) {
      showToast(t('detail.blocked'), 'error');
      return;
    }
    enqueueAlbum(detail.albumId, detail.name);
    showToast(t('common.queuedToast', {name: detail.name}));
  };

  const handleRead = () => {
    if (!detail) return;
    if (libraryItem?.pagesDir) {
      openLocal(undefined, resumePage);
      return;
    }
    openOnline(undefined, history ? resumePage : undefined);
  };

  const metaBlocks = useMemo(() => {
    if (!detail) return [];
    return (
      [
        {title: t('meta.author'), tags: detail.authors ?? []},
        {title: t('meta.tags'), tags: detail.tags ?? []},
        {title: t('meta.works'), tags: detail.works ?? []},
        {title: t('meta.actors'), tags: detail.actors ?? []},
      ] as const
    )
      .map((b) => ({title: b.title, tags: b.tags.map((t) => t.trim()).filter(Boolean)}))
      .filter((b) => b.tags.length > 0);
  }, [detail]);

  return (
    <div className="nav-screen">
      <NavBar
        title={detail?.name ?? fallbackTitle ?? t('detail.title')}
        onBack={back}
        right={<span style={{width: 'var(--control-xl)'}} aria-hidden />}
      />
      {error && !detail ? (
        <div className="nav-scroll">
          <div className="app-empty">
            <EmptyState icon="cloud-off" title={t('detail.loadFailed')} hint={error} />
            <Button className={styles.retry} onClick={() => void load(albumId, true)}>
              {t('common.retry')}
            </Button>
          </div>
        </div>
      ) : !detail ? (
        <div className="nav-scroll">
          <AlbumDetailSkeleton />
        </div>
      ) : (
        <div className={`nav-scroll ${styles.scroll}`}>
          <DetailHero detail={detail} />
          <DetailActions
            local={Boolean(libraryItem?.pagesDir)}
            downloaded={downloading}
            hasHistory={Boolean(history)}
            resumePage={resumePage}
            onRead={handleRead}
            onDownload={onRequestDownload}
          />
          <DetailTags blocks={metaBlocks} onTagPress={(tag) => pushSearch({query: tag})} />
          <DetailDesc description={detail.description} />
          <DetailChapters
            episodes={detail.episodes}
            pageCount={detail.pageCount}
            currentSort={resumeSort}
            resumePage={resumePage}
            hasHistory={Boolean(history)}
            onOpen={openChapter}
          />
          <DetailRelated albums={detail.related} onOpen={pushDetail} />
        </div>
      )}
    </div>
  );
}

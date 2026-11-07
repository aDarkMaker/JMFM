import {useEffect, useMemo, useRef, useState} from 'react';
import type {AlbumSummary} from '../../core/model';
import {useAlbumDetailStore} from '../stores/albumDetail';
import {useHistoryStore} from '../stores/history';
import {useLibraryStore} from '../stores/library';
import {useDownloadStore} from '../stores/download';
import {useSettingsStore} from '../stores/settings';
import {useToastStore} from '../stores/toast';
import {useDownloadTask} from '../hooks/useDownloadTask';
import {useNavStack} from '../hooks/useNavStack';
import {EmptyState} from '../components/EmptyState';
import {Icon} from '../components/Icon';
import {AlbumDetailSkeleton} from '../components/Skeletons';
import {isBlockedAlbum} from '../../core/model/blocklist';
import {hasJapanese} from '../hooks/useJapaneseFont';
import type {ReaderTarget} from '../reader/types';

function formatCount(n: number | undefined): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

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
  const downloading = useDownloadStore((s) =>
    s.tasks.some((t) => t.albumId === albumId)
  );
  const blacklistTags = useSettingsStore((s) => s.settings.blacklistTags);
  const {enqueueAlbum} = useDownloadTask();
  const showToast = useToastStore((s) => s.show);

  const [descOpen, setDescOpen] = useState(false);
  const [descOverflow, setDescOverflow] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

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

  useEffect(() => {
    setDescOpen(false);
    const el = descRef.current;
    if (!el || !detail?.description) {
      setDescOverflow(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setDescOverflow(el.scrollHeight > el.clientHeight + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [detail?.albumId, detail?.description]);

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
      online: {
        albumId: detail.albumId,
        photoId: ep.photoId,
        scrambleId: detail.scrambleId,
      },
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
      showToast('该漫画命中屏蔽标签', 'error');
      return;
    }
    enqueueAlbum(detail.albumId, detail.name);
    showToast(`已加入下载队列：${detail.name}`);
  };

  const handleRead = () => {
    if (!detail) return;
    if (libraryItem?.pagesDir) {
      openLocal(undefined, resumePage);
      return;
    }
    openOnline(undefined, history ? resumePage : undefined);
  };

  const metaBlocks = detail
    ? (
        [
          {title: '作者', tags: detail.authors ?? []},
          {title: '标签', tags: detail.tags ?? []},
          {title: '作品', tags: detail.works ?? []},
          {title: '出场人物', tags: detail.actors ?? []},
        ] as const
      )
        .map((b) => ({
          title: b.title,
          tags: b.tags.map((t) => t.trim()).filter(Boolean),
        }))
        .filter((b) => b.tags.length > 0)
    : [];

  return (
    <div className="nav-screen">
      <div className="nav-bar">
        <button className="nav-btn" onClick={back} aria-label="返回">
          <Icon name="arrow-back" size={22} />
        </button>
        <span className="nav-title">{detail?.name ?? fallbackTitle ?? '漫画详情'}</span>
        <span className="nav-btn" aria-hidden />
      </div>

      {error && !detail ? (
        <div className="nav-scroll">
          <div className="app-empty">
            <EmptyState icon="cloud-off" title="详情加载失败" hint={error} />
            <button className="home-retry btn-primary" onClick={() => void load(albumId, true)}>
              重试
            </button>
          </div>
        </div>
      ) : !detail ? (
        <div className="nav-scroll">
          <AlbumDetailSkeleton />
        </div>
      ) : (
        <div className="nav-scroll detail-scroll">
          <div className="detail-hero">
            <div className="detail-hero-bg" aria-hidden />
            <div className="detail-cover">
              {detail.coverUrl ? <img src={detail.coverUrl} alt="" decoding="async" /> : null}
            </div>
            <div className="detail-head">
              <h1 className="detail-title">{detail.name}</h1>
              {detail.author ? <span className="detail-author">{detail.author}</span> : null}
              <div className="detail-stats">
                <span>{detail.episodes.length} 话</span>
                {detail.pageCount ? <span>{detail.pageCount} 页</span> : null}
                {formatCount(detail.likesCount) ? (
                  <span>{formatCount(detail.likesCount)} 喜欢</span>
                ) : null}
                {formatCount(detail.viewsCount) ? (
                  <span>{formatCount(detail.viewsCount)} 观看</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="detail-actions">
            <button className="detail-primary" onClick={handleRead}>
              <Icon
                name={libraryItem ? (history ? 'play-arrow' : 'auto-stories') : 'visibility'}
                size={20}
              />
              {libraryItem
                ? history
                  ? `继续阅读 P.${resumePage}`
                  : '开始阅读'
                : history
                  ? `在线预览 P.${resumePage}`
                  : '在线预览'}
            </button>
            <button
              className={`detail-secondary${downloading ? ' is-active' : ''}`}
              disabled={downloading || libraryItem != null}
              onClick={onRequestDownload}
            >
              <Icon
                name={libraryItem ? 'download-done' : downloading ? 'sync' : 'download'}
                size={18}
              />
              {libraryItem ? '已在资源页' : downloading ? '下载中' : '下载到本地'}
            </button>
          </div>

          {metaBlocks.length > 0 ? (
            <div className="detail-tag-blocks">
              {metaBlocks.map((block) => (
                <div className="tag-block" key={block.title}>
                  <span className="tag-block-title">{block.title}</span>
                  <div className="tag-block-tags">
                    {block.tags.map((tag) => (
                      <button
                        key={tag}
                        className={`chip chip-sm${hasJapanese(tag) ? ' is-ja' : ''}`}
                        onClick={() => pushSearch({query: tag})}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {detail.description ? (
            <div className={`detail-desc${descOpen ? ' is-open' : ''}${descOverflow ? ' has-overflow' : ''}`}>
              <span className="tag-block-title">简介</span>
              <p ref={descRef} className="detail-desc-text">
                {detail.description}
              </p>
              {descOverflow ? (
                <button
                  type="button"
                  className="detail-desc-toggle"
                  onClick={() => setDescOpen((open) => !open)}
                >
                  {descOpen ? '收起' : '展开'}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="detail-chapters">
            <span className="tag-block-title">
              {detail.episodes.length > 1 ? `章节 · ${detail.episodes.length}` : '章节'}
            </span>
            {detail.episodes.length > 1 ? (
              <div className="chapter-grid">
                {detail.episodes.map((ep) => {
                  const current = resumeSort === ep.sort;
                  return (
                    <button
                      key={ep.photoId}
                      className={`chapter-chip${current ? ' is-current' : ''}`}
                      onClick={() => openChapter(ep.sort, current ? resumePage : undefined)}
                    >
                      {ep.name?.trim() ? ep.name : `第 ${ep.sort} 话`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                className="chapter-chip is-wide"
                onClick={() => openChapter(detail.episodes[0].sort, history ? resumePage : undefined)}
              >
                共 {detail.pageCount ?? detail.episodes.length} 页 ·
                {history ? ` 从 P.${resumePage} 继续` : ' 从头开始'}
              </button>
            )}
          </div>

          {detail.related.length > 0 ? (
            <div className="detail-related">
              <span className="tag-block-title">相关推荐</span>
              <div className="related-row">
                {detail.related.slice(0, 12).map((album) => (
                  <button
                    key={album.albumId}
                    className="related-card"
                    onClick={() => pushDetail(album.albumId, album.name)}
                  >
                    <span className="related-cover">
                      {album.coverUrl ? <img src={album.coverUrl} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="related-title">{album.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

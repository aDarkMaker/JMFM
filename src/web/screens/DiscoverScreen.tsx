import {useEffect, useMemo, useRef} from 'react';
import {gsap} from 'gsap';
import {useShallow} from 'zustand/react/shallow';
import {SORT_OPTIONS} from '../../core/constants/sort';
import {useBrowseFeedStore, selectVisibleFeed, selectIsSwitching} from '../stores/browseFeed';
import {useBrowseStore} from '../stores/browse';
import {EmptyState} from '../components/EmptyState';
import {Icon} from '../components/Icon';
import {AlbumListSection} from '../components/AlbumListSection';
import {AlbumRowSkeleton} from '../components/Skeletons';
import {useInfiniteScroll} from '../hooks/useInfiniteScroll';
import {useNavStack} from '../hooks/useNavStack';
import {buildCategoryChips} from '../library/categoryChips';
import {hasJapanese} from '../hooks/useJapaneseFont';

export function DiscoverScreen({
  initialCategory,
  initialOrder,
}: {
  initialCategory?: string;
  initialOrder?: string;
} = {}) {
  const {back, pushSearch, pushDetail} = useNavStack();
  const categories = useBrowseStore((s) => s.categories);
  const blocks = useBrowseStore((s) => s.blocks);
  const loadCategories = useBrowseStore((s) => s.loadCategories);
  const category = useBrowseFeedStore((s) => s.category);
  const order = useBrowseFeedStore((s) => s.order);
  const setCategory = useBrowseFeedStore((s) => s.setCategory);
  const setOrder = useBrowseFeedStore((s) => s.setOrder);
  const load = useBrowseFeedStore((s) => s.load);
  const feed = useBrowseFeedStore(useShallow(selectVisibleFeed));
  const loadingKey = useBrowseFeedStore((s) => s.loadingKey);
  const switching = useBrowseFeedStore(selectIsSwitching);

  const loading = loadingKey != null;
  const sentinelRef = useInfiniteScroll({
    disabled: loading || feed.end,
    onLoadMore: () => void load(),
  });

  const firstLoadRef = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const staggerKeyRef = useRef('');

  useEffect(() => {
    const list = listRef.current;
    if (!list || feed.items.length === 0) return;
    const key = `${category}|${order}`;
    if (staggerKeyRef.current === key) return;
    staggerKeyRef.current = key;
    const rows = list.querySelectorAll('.album-row');
    if (rows.length === 0) return;
    gsap.fromTo(
      rows,
      {opacity: 0, y: 10},
      {opacity: 1, y: 0, duration: 0.26, ease: 'power2.out', stagger: 0.03, overwrite: 'auto'}
    );
  }, [category, order, feed.items.length]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!firstLoadRef.current) return;
    firstLoadRef.current = false;
    const store = useBrowseFeedStore.getState();
    const wantsCategory = initialCategory && initialCategory !== store.category;
    const wantsOrder = initialOrder && initialOrder !== store.order;
    if (wantsCategory || wantsOrder) {
      store.setFilter(wantsCategory ? initialCategory! : store.category, initialOrder);
      return;
    }
    // The feed may already be cached from an earlier visit in this session.
    if (selectVisibleFeed(useBrowseFeedStore.getState()).items.length > 0) return;
    void load();
  }, [load, initialCategory, initialOrder]);

  const chips = useMemo(() => buildCategoryChips(categories), [categories]);

  return (
    <div className="nav-screen">
      <div className="nav-bar">
        <button className="nav-btn" onClick={back} aria-label="返回">
          <Icon name="arrow-back" size={22} />
        </button>
        <span className="nav-title">发现</span>
        <button className="nav-btn" onClick={() => pushSearch()} aria-label="搜索">
          <Icon name="search" size={22} />
        </button>
      </div>
      <div className={`nav-scroll${switching ? ' is-switching' : ''}`}>
        <div className="chip-row" role="tablist" aria-label="分类">
          {chips.map((c) => (
            <button
              key={`${c.slug}-${c.name}`}
              role="tab"
              aria-selected={category === c.slug}
              className={`chip${category === c.slug ? ' is-active' : ''}`}
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="chip-row chip-row-muted" role="tablist" aria-label="排序">
          <span className="chip-row-label" aria-hidden>
            <Icon name="sort" size={14} />
          </span>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.code}
              role="tab"
              aria-selected={order === o.code}
              className={`chip chip-sm${order === o.code ? ' is-active' : ''}`}
              onClick={() => setOrder(o.code)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {feed.items.length === 0 && feed.error ? (
          <div className="app-empty app-empty--fixed">
            <EmptyState icon="cloud-off" title="列表加载失败" hint={feed.error} />
            <button className="home-retry btn-primary" type="button" onClick={() => void load(true)}>
              重试
            </button>
          </div>
        ) : feed.items.length === 0 ? (
          feed.end ? (
            <div className="app-empty app-empty--fixed">
              <EmptyState icon="photo-library" title="这个分类还没有漫画" hint="换个分类看看" />
            </div>
          ) : (
            <AlbumRowSkeleton count={8} />
          )
        ) : (
          <AlbumListSection
            albums={feed.items}
            listRef={listRef}
            onPress={(album) => pushDetail(album.albumId, album.name)}
          />
        )}

        <div ref={sentinelRef} className="scroll-sentinel">
          {loading ? <span className="scroll-loading" aria-label="加载中" /> : null}
          {feed.end && feed.items.length > 0 ? (
            <span className="scroll-end">已经没有更多了</span>
          ) : null}
        </div>

        {blocks.length > 0 ? (
          <section className="tag-explore" aria-label="标签探索">
            <header className="tag-explore-head">
              <h2 className="tag-explore-title">标签探索</h2>
              <p className="tag-explore-hint">横向滑动浏览，点选即可搜索</p>
            </header>
            <div className="tag-explore-list">
              {blocks.map((block) => {
                const tags = block.tags.map((t) => t.trim()).filter(Boolean);
                if (tags.length === 0) return null;
                return (
                  <div className="tag-rail" key={block.title}>
                    <div className="tag-rail-head">
                      <span className="tag-rail-title">{block.title}</span>
                      <span className="tag-rail-count">{tags.length}</span>
                    </div>
                    <div className="tag-rail-track" role="list">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          role="listitem"
                          className={`chip chip-sm tag-rail-chip${hasJapanese(tag) ? ' is-ja' : ''}`}
                          onClick={() => pushSearch({query: tag})}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

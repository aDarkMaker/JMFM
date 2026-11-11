import {t, type MessageKey} from '@/web/i18n';
import {useEffect, useMemo, useRef} from 'react';
import {gsap} from 'gsap';
import {useShallow} from 'zustand/react/shallow';
import styles from './discover.module.css';
import {SORT_OPTIONS} from '@/core/constants/sort';
import {useBrowseFeedStore, selectVisibleFeed, selectIsSwitching} from '@/web/stores/browseFeed';
import {useBrowseStore} from '@/web/stores/browse';
import {EmptyState} from '@/web/ui/EmptyState';
import {NavBar} from '@/web/ui/NavBar';
import {Chip, ChipRow} from '@/web/ui/Chip';
import {Button} from '@/web/ui/Button';
import {Icon} from '@/web/shared/Icon';
import {AlbumListSection} from '@/web/shared/AlbumListSection';
import {AlbumRowSkeleton} from '@/web/shared/Skeletons';
import {ListFooter} from '@/web/shared/ListFooter';
import {useInfiniteScroll} from '@/web/hooks/useInfiniteScroll';
import {useNavStack} from '@/web/hooks/useNavStack';
import {buildCategoryChips} from '@/web/library/categoryChips';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';
import {IconButton} from '@/web/ui/IconButton';

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
    const rows = list.children;
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
      <NavBar
        title={t('discover.title')}
        onBack={back}
        right={
          <IconButton label={t('discover.search')} onClick={() => pushSearch()}>
            <Icon name="search" size={22} />
          </IconButton>
        }
      />
      <div className={`nav-scroll${switching ? ' is-switching' : ''}`}>
        <ChipRow label={t('discover.category')}>
          {chips.map((c) => (
            <Chip
              key={`${c.slug}-${c.name}`}
              active={category === c.slug}
              onClick={() => setCategory(c.slug)}
            >
              {c.name}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow muted label={t('discover.sort')}>
          <span style={{display: 'inline-flex', alignItems: 'center', color: 'var(--ink-tertiary)'}} aria-hidden>
            <Icon name="sort" size={14} />
          </span>
          {SORT_OPTIONS.map((o) => (
            <Chip key={o.code} size="sm" active={order === o.code} onClick={() => setOrder(o.code)}>
              {t(o.labelKey as MessageKey)}
            </Chip>
          ))}
        </ChipRow>

        {feed.items.length === 0 && feed.error ? (
          <div className="app-empty app-empty--fixed">
            <EmptyState icon="cloud-off" title={t('discover.loadFailed')} hint={feed.error} />
            <Button onClick={() => void load(true)}>{t('common.retry')}</Button>
          </div>
        ) : feed.items.length === 0 ? (
          feed.end ? (
            <div className="app-empty app-empty--fixed">
              <EmptyState
                icon="photo-library"
                title={t('discover.empty')}
                hint={t('discover.emptyHint')}
              />
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

        <ListFooter sentinelRef={sentinelRef} loading={loading} end={feed.end} showEnd={feed.items.length > 0} />

        {blocks.length > 0 ? (
          <section className={styles.explore} aria-label={t('discover.tagExplore')}>
            <header className={styles.exploreHead}>
              <h2 className={styles.exploreTitle}>{t('discover.tagExplore')}</h2>
              <p className={styles.exploreHint}>{t('discover.tagExploreHint')}</p>
            </header>
            <div className={styles.exploreList}>
              {blocks.map((block) => {
                const tags = block.tags.map((t) => t.trim()).filter(Boolean);
                if (tags.length === 0) return null;
                return (
                  <div className={styles.rail} key={block.title}>
                    <div className={styles.railHead}>
                      <span className={styles.railTitle}>{block.title}</span>
                      <span className={styles.railCount}>{tags.length}</span>
                    </div>
                    <div className={styles.railTrack} role="list">
                      {tags.map((tag) => (
                        <Chip
                          key={tag}
                          size="sm"
                          onClick={() => pushSearch({query: tag})}
                        >
                          <span className={hasJapanese(tag) ? 'is-ja' : undefined}>{tag}</span>
                        </Chip>
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

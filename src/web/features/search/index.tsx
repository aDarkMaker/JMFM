import {t, type MessageKey} from '@/web/i18n';
import {useEffect, useRef, useState} from 'react';
import styles from './search.module.css';
import {SEARCH_SORT_OPTIONS} from '@/core/constants/sort';
import {HOT_SEARCH_TAGS} from '@/core/constants/search';
import {useSearchStore} from '@/web/stores/search';
import {useBrowseStore} from '@/web/stores/browse';
import {EmptyState} from '@/web/ui/EmptyState';
import {NavBar} from '@/web/ui/NavBar';
import {Chip, ChipRow} from '@/web/ui/Chip';
import {Button} from '@/web/ui/Button';
import {AlbumListSection} from '@/web/shared/AlbumListSection';
import {AlbumRowSkeleton} from '@/web/shared/Skeletons';
import {SearchBar} from '@/web/shared/SearchBar';
import {ListFooter} from '@/web/shared/ListFooter';
import {useInfiniteScroll} from '@/web/hooks/useInfiniteScroll';
import {useNavStack} from '@/web/hooks/useNavStack';

const DEBOUNCE_MS = 650;


export function SearchScreen({initialQuery = ''}: {initialQuery?: string}) {
  const {back, pushDetail} = useNavStack();
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.items);
  const end = useSearchStore((s) => s.end);
  const total = useSearchStore((s) => s.total);
  const shownQuery = useSearchStore((s) => s.shownQuery);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const recent = useSearchStore((s) => s.recent);
  const order = useSearchStore((s) => s.order);
  const category = useSearchStore((s) => s.category);
  const setOrder = useSearchStore((s) => s.setOrder);
  const setCategory = useSearchStore((s) => s.setCategory);
  const setQuery = useSearchStore((s) => s.setQuery);
  const submit = useSearchStore((s) => s.submit);
  const loadMore = useSearchStore((s) => s.loadMore);
  const loadRecent = useSearchStore((s) => s.loadRecent);
  const clearRecent = useSearchStore((s) => s.clearRecent);
  const categories = useBrowseStore((s) => s.categories);
  const loadCategories = useBrowseStore((s) => s.loadCategories);

  const [input, setInput] = useState(initialQuery || query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    void loadRecent();
    void loadCategories();
  }, [loadRecent, loadCategories]);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (initialQuery.trim()) {
      void submit(initialQuery);
    }
  }, [initialQuery, submit]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setQuery('');
      return;
    }
    void submit(trimmed);
  };

  const handleInput = (value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setQuery('');
      return;
    }
    // Wait for a settled query; short taps / composing shouldn't fire the API.
    if (trimmed.length < 2) return;
    debounceRef.current = setTimeout(() => void submit(trimmed), DEBOUNCE_MS);
  };

  const sentinelRef = useInfiniteScroll({
    disabled: loading || end || !query,
    onLoadMore: () => void loadMore(),
  });

  const hasResults = results.length > 0;

  return (
    <div className="nav-screen">
      <NavBar
        search
        onBack={back}
        left={
          <div className={styles.navSearch}>
            <SearchBar
              variant="nav"
              value={input}
              onChange={handleInput}
              onSubmit={runSearch}
              placeholder={t('search.placeholder')}
              autoFocus
            />
          </div>
        }
      />
      <div className="nav-scroll">
        {hasResults || query ? (
          <ChipRow muted label={t('search.sort')}>
            {SEARCH_SORT_OPTIONS.map((o) => (
              <Chip key={o.code} size="sm" active={order === o.code} onClick={() => setOrder(o.code)}>
                {t(o.labelKey as MessageKey)}
              </Chip>
            ))}
            {categories.slice(0, 6).map((c) => (
              <Chip
                key={c.slug}
                size="sm"
                active={category === c.slug}
                onClick={() => setCategory(category === c.slug ? '' : c.slug)}
              >
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        {!query ? (
          <div className={styles.idle}>
            {recent.length > 0 ? (
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>{t('search.recent')}</span>
                  <button type="button" className={styles.sectionAction} onClick={() => void clearRecent()}>
                    {t('common.clear')}
                  </button>
                </div>
                <ChipRow>
                  {recent.map((term) => (
                    <Chip
                      key={term}
                      size="sm"
                      onClick={() => {
                        setInput(term);
                        void submit(term);
                      }}
                    >
                      {term}
                    </Chip>
                  ))}
                </ChipRow>
              </div>
            ) : null}
            <div className={styles.section}>
              <span className={styles.sectionTitle}>{t('search.hot')}</span>
              <ChipRow>
                {HOT_SEARCH_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    size="sm"
                    onClick={() => {
                      setInput(tag);
                      void submit(tag);
                    }}
                  >
                    {tag}
                  </Chip>
                ))}
              </ChipRow>
            </div>
          </div>
        ) : error && !hasResults ? (
          <div className="app-empty app-empty--fixed">
            <EmptyState icon="cloud-off" title={t('search.failed')} hint={error} />
            <Button onClick={() => void submit(query)}>{t('common.retry')}</Button>
          </div>
        ) : !hasResults && loading ? (
          <AlbumRowSkeleton count={6} />
        ) : !hasResults ? (
          <div className="app-empty app-empty--fixed">
            <EmptyState
              icon="search"
              title={t('search.empty')}
              hint={t('search.emptyHint')}
            />
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              {shownQuery === query
                ? t('search.results', {total})
                : t('search.searching', {query})}
            </div>
            <AlbumListSection
              albums={results}
              onPress={(album) => pushDetail(album.albumId, album.name)}
            />
          </>
        )}

        <ListFooter sentinelRef={sentinelRef} loading={loading && hasResults} end={end} showEnd={hasResults} />
      </div>
    </div>
  );
}

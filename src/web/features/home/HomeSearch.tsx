import {t, type MessageKey} from '@/web/i18n';
import {useEffect, useRef, useState} from 'react';
import styles from './homeSearch.module.css';
import {SEARCH_SORT_OPTIONS} from '@/core/constants/sort';
import {HOT_SEARCH_TAGS} from '@/core/constants/search';
import {useSearchStore} from '@/web/stores/search';
import {useBrowseStore} from '@/web/stores/browse';
import {EmptyState} from '@/web/ui/EmptyState';
import {Chip, ChipRow} from '@/web/ui/Chip';
import {Button} from '@/web/ui/Button';
import {AlbumListSection} from '@/web/shared/AlbumListSection';
import {AlbumRowSkeleton} from '@/web/shared/Skeletons';
import {SearchBar} from '@/web/shared/SearchBar';
import {ListFooter} from '@/web/shared/ListFooter';
import {useInfiniteScroll} from '@/web/hooks/useInfiniteScroll';

const DEBOUNCE_MS = 650;
const EXIT_MS = 280;


export interface HomeSearchProps {
  onOpenAlbum: (albumId: number, title: string) => void;
}

/** In-place home search: brand collapses, field expands, panel slides down. */
export function HomeSearch({onOpenAlbum}: HomeSearchProps) {
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState(false);
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

  const [input, setInput] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    void loadRecent();
    void loadCategories();
  }, [open, loadRecent, loadCategories]);

  useEffect(() => {
    if (!open) return;
    const screen = document.querySelector('.app-screen');
    screen?.classList.add('is-search-locked');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      screen?.classList.remove('is-search-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (exitRef.current) clearTimeout(exitRef.current);
      document.querySelector('.app-screen')?.classList.remove('is-search-locked');
    };
  }, []);

  const close = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (exitRef.current) clearTimeout(exitRef.current);
    setOpen(false);
    inputRef.current?.blur();
    exitRef.current = setTimeout(() => {
      setLayer(false);
      exitRef.current = null;
    }, EXIT_MS);
  };

  const openSearch = () => {
    if (exitRef.current) {
      clearTimeout(exitRef.current);
      exitRef.current = null;
    }
    setInput(query);
    setLayer(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOpen(true);
        inputRef.current?.focus();
      });
    });
  };

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
    if (trimmed.length < 2) return;
    debounceRef.current = setTimeout(() => {
      if (openRef.current) void submit(trimmed);
    }, DEBOUNCE_MS);
  };

  const pickTerm = (term: string) => {
    setInput(term);
    void submit(term);
  };

  const sentinelRef = useInfiniteScroll({
    disabled: !open || loading || end || !query,
    onLoadMore: () => void loadMore(),
  });

  const hasResults = results.length > 0;

  return (
    <div
      className={[styles.shell, 'sticky-chrome', open ? styles.shellOpen : '', layer ? styles.shellLayer : '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className={[styles.topbar, open ? styles.searching : ''].filter(Boolean).join(' ')}>
        <span className={styles.brand} aria-label="JMFM" aria-hidden={open || undefined}>
          JMFM
        </span>
        <div className={styles.field}>
          <SearchBar
            ref={inputRef}
            variant="home"
            expanded={open}
            value={input}
            onChange={handleInput}
            onSubmit={runSearch}
            onFocus={() => {
              if (!openRef.current) openSearch();
            }}
            placeholder={t('search.placeholder')}
          />
        </div>
        <button
          type="button"
          className={styles.cancel}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          onClick={close}
        >
          {t('common.cancel')}
        </button>
      </header>

      {layer ? (
        <>
          <button
            type="button"
            className={styles.scrim}
            aria-label={t('search.close')}
            tabIndex={open ? 0 : -1}
            onClick={close}
          />
          <div className={styles.panel} role="dialog" aria-label={t('common.search')} aria-hidden={!open}>
            {hasResults || query ? (
              <ChipRow muted label={t('search.sort')}>
                {SEARCH_SORT_OPTIONS.map((o) => (
                  <Chip
                    key={o.code}
                    size="sm"
                    active={order === o.code}
                    onClick={() => setOrder(o.code)}
                  >
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
                      <button
                        type="button"
                        className={styles.sectionAction}
                        onClick={() => void clearRecent()}
                      >
                        {t('common.clear')}
                      </button>
                    </div>
                    <div className={styles.chipRow}>
                      {recent.map((term) => (
                        <Chip key={term} size="sm" onClick={() => pickTerm(term)}>
                          {term}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className={styles.section}>
                  <span className={styles.sectionTitle}>{t('search.hot')}</span>
                  <div className={styles.chipRow}>
                    {HOT_SEARCH_TAGS.map((tag) => (
                      <Chip key={tag} size="sm" onClick={() => pickTerm(tag)}>
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            ) : error && !hasResults ? (
              <div className="app-empty app-empty--fixed">
                <EmptyState icon="cloud-off" title={t('search.failed')} hint={error} />
                <Button className={styles.retry} onClick={() => void submit(query)}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : !hasResults && loading ? (
              <AlbumRowSkeleton count={5} />
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
                  onPress={(album) => {
                    close();
                    onOpenAlbum(album.albumId, album.name);
                  }}
                />
              </>
            )}

            <ListFooter
              sentinelRef={sentinelRef}
              loading={loading && hasResults}
              end={end && hasResults}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

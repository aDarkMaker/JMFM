import {useEffect, useRef, useState} from 'react';
import {SEARCH_SORT_OPTIONS} from '../../core/constants/sort';
import {useSearchStore} from '../stores/search';
import {useBrowseStore} from '../stores/browse';
import {EmptyState} from './EmptyState';
import {AlbumListSection} from './AlbumListSection';
import {AlbumRowSkeleton} from './Skeletons';
import {SearchBar} from './SearchBar';
import {useInfiniteScroll} from '../hooks/useInfiniteScroll';

const DEBOUNCE_MS = 650;
const EXIT_MS = 280;
const HOT_TAGS = ['中文', '巨乳', '校园', 'NTR', '纯爱', '全彩', '百合', '人妻'];

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
    <div className={`home-search-shell${open ? ' is-open' : ''}${layer ? ' is-layer' : ''}`}>
      <header className={`home-topbar${open ? ' is-searching' : ''}`}>
        <span className="home-brand" aria-label="JMFM" aria-hidden={open || undefined}>
          JMFM
        </span>
        <div className="home-search-field">
          <SearchBar
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onSubmit={runSearch}
            onFocus={() => {
              if (!openRef.current) openSearch();
            }}
            placeholder="搜索漫画、标签"
          />
        </div>
        <button
          type="button"
          className="home-search-cancel"
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          onClick={close}
        >
          取消
        </button>
      </header>

      {layer ? (
        <>
          <button
            type="button"
            className="home-search-scrim"
            aria-label="关闭搜索"
            tabIndex={open ? 0 : -1}
            onClick={close}
          />
          <div className="home-search-panel" role="dialog" aria-label="搜索" aria-hidden={!open}>
            {hasResults || query ? (
              <div className="chip-row chip-row-muted" role="tablist" aria-label="排序">
                {SEARCH_SORT_OPTIONS.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    role="tab"
                    aria-selected={order === o.code}
                    className={`chip chip-sm${order === o.code ? ' is-active' : ''}`}
                    onClick={() => setOrder(o.code)}
                  >
                    {o.label}
                  </button>
                ))}
                {categories.slice(0, 6).map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    role="tab"
                    aria-selected={category === c.slug}
                    className={`chip chip-sm${category === c.slug ? ' is-active' : ''}`}
                    onClick={() => setCategory(category === c.slug ? '' : c.slug)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}

            {!query ? (
              <div className="search-idle">
                {recent.length > 0 ? (
                  <div className="search-section">
                    <div className="search-section-head">
                      <span className="search-section-title">最近搜索</span>
                      <button
                        type="button"
                        className="search-section-action"
                        onClick={() => void clearRecent()}
                      >
                        清空
                      </button>
                    </div>
                    <div className="chip-row">
                      {recent.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="chip chip-sm"
                          onClick={() => pickTerm(term)}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="search-section">
                  <span className="search-section-title">大家都在搜</span>
                  <div className="chip-row">
                    {HOT_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="chip chip-sm"
                        onClick={() => pickTerm(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : error && !hasResults ? (
              <div className="app-empty app-empty--fixed">
                <EmptyState icon="cloud-off" title="搜索失败" hint={error} />
                <button
                  className="home-retry btn-primary"
                  type="button"
                  onClick={() => void submit(query)}
                >
                  重试
                </button>
              </div>
            ) : !hasResults && loading ? (
              <AlbumRowSkeleton count={5} />
            ) : !hasResults ? (
              <div className="app-empty app-empty--fixed">
                <EmptyState icon="search" title="没有找到相关漫画" hint="换个关键词或标签试试" />
              </div>
            ) : (
              <>
                <div className="search-summary">
                  {shownQuery === query ? `共 ${total} 条结果` : `正在搜索「${query}」…`}
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

            <div ref={sentinelRef} className="scroll-sentinel">
              {loading && hasResults ? (
                <span className="scroll-loading" aria-label="加载中" />
              ) : null}
              {end && hasResults ? <span className="scroll-end">已经没有更多了</span> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

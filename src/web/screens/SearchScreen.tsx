import {useEffect, useRef, useState} from 'react';
import {SEARCH_SORT_OPTIONS} from '../../core/constants/sort';
import {useSearchStore} from '../stores/search';
import {useBrowseStore} from '../stores/browse';
import {EmptyState} from '../components/EmptyState';
import {Icon} from '../components/Icon';
import {AlbumListSection} from '../components/AlbumListSection';
import {AlbumRowSkeleton} from '../components/Skeletons';
import {SearchBar} from '../components/SearchBar';
import {useInfiniteScroll} from '../hooks/useInfiniteScroll';
import {useNavStack} from '../hooks/useNavStack';

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
      <div className="nav-bar nav-bar-search">
        <button className="nav-btn" onClick={back} aria-label="返回">
          <Icon name="arrow-back" size={22} />
        </button>
        <div className="nav-search">
          <SearchBar
            value={input}
            onChange={handleInput}
            onSubmit={runSearch}
            placeholder="搜索漫画、标签"
            autoFocus
          />
        </div>
      </div>
      <div className="nav-scroll">
        {hasResults || query ? (
          <div className="chip-row chip-row-muted" role="tablist" aria-label="排序">
            {SEARCH_SORT_OPTIONS.map((o) => (
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
            {categories.slice(0, 6).map((c) => (
              <button
                key={c.slug}
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
                  <button className="search-section-action" onClick={() => void clearRecent()}>
                    清空
                  </button>
                </div>
                <div className="chip-row">
                  {recent.map((term) => (
                    <button
                      key={term}
                      className="chip chip-sm"
                      onClick={() => {
                        setInput(term);
                        void submit(term);
                      }}
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
                {['中文', '巨乳', '校园', 'NTR', '纯爱', '全彩', '百合', '人妻'].map((tag) => (
                  <button
                    key={tag}
                    className="chip chip-sm"
                    onClick={() => {
                      setInput(tag);
                      void submit(tag);
                    }}
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
          <AlbumRowSkeleton count={6} />
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
              onPress={(album) => pushDetail(album.albumId, album.name)}
            />
          </>
        )}

        <div ref={sentinelRef} className="scroll-sentinel">
          {loading && hasResults ? <span className="scroll-loading" aria-label="加载中" /> : null}
          {end && hasResults ? <span className="scroll-end">已经没有更多了</span> : null}
        </div>
      </div>
    </div>
  );
}

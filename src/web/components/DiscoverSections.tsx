import {useEffect, useMemo, useRef} from 'react';
import type {AlbumSummary} from '../../core/model';
import {useBrowseStore} from '../stores/browse';
import {buildCategoryChips} from '../library/categoryChips';
import {Icon} from './Icon';
import {Poster} from './Poster';
import {CategoryGridSkeleton, HotRailSkeleton} from './Skeletons';

export function WeeklyHotRow({onPress}: {onPress: (album: AlbumSummary) => void}) {
  const items = useBrowseStore((s) => s.hot);
  const loading = useBrowseStore((s) => s.hotLoading);
  const load = useBrowseStore((s) => s.loadHot);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);

  // Defer the hot request until the rail is near the viewport, so it never
  // competes with the cold-start recommendation burst.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || requestedRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      requestedRef.current = true;
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        requestedRef.current = true;
        io.disconnect();
        void load();
      },
      {rootMargin: '200px'}
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  return (
    <div ref={rootRef} className="hot-slot">
      {items.length === 0 ? (
        loading ? <HotRailSkeleton /> : null
      ) : (
        <div className="hot-rail">
          {items.map((album) => (
            <HotCard key={album.albumId} album={album} onPress={onPress} />
          ))}
        </div>
      )}
    </div>
  );
}

function HotCard({album, onPress}: {album: AlbumSummary; onPress: (a: AlbumSummary) => void}) {
  return (
    <button className="hot-card" onClick={() => onPress(album)}>
      <Poster
        coverPath={album.coverUrl}
        title={album.name}
        tintIndex={album.albumId}
        fallbackChars={2}
      />
      <span className="hot-title">{album.name}</span>
    </button>
  );
}

export function CategoryGrid({onPick}: {onPick: (slug: string) => void}) {
  const categories = useBrowseStore((s) => s.categories);
  const loading = useBrowseStore((s) => s.categoriesLoading);
  const loadCategories = useBrowseStore((s) => s.loadCategories);
  const rootRef = useRef<HTMLDivElement>(null);

  // Defer the taxonomy request until the grid approaches the viewport so it
  // does not compete with the cold-start recommendation burst.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      void loadCategories();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void loadCategories();
      },
      {rootMargin: '200px'}
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadCategories]);

  const entries = useMemo(() => buildCategoryChips(categories, 8).slice(1), [categories]);
  if (categories.length === 0 && loading) {
    return (
      <div ref={rootRef}>
        <CategoryGridSkeleton />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="category-grid">
      {entries.map((c) => (
        <button key={c.slug} className="category-tile" onClick={() => onPick(c.slug)}>
          <span className="category-tile-icon">
            <Icon name="auto-stories" size={22} />
          </span>
          <span className="category-tile-label">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

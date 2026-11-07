import {ALL_CATEGORY, CATEGORY_FALLBACK} from '../../core/constants/sort';

export interface CategoryChip {
  slug: string;
  name: string;
}

/** Minimal shape shared by API categories and the constant fallback. */
export type CategoryLike = Pick<CategoryChip, 'slug' | 'name'>;

/**
 * Category chips for Discover. The API also ships a slug=`0` "最新" entry, so
 * it is dropped before prepending the synthetic one; otherwise both render
 * with the same React key and both look active.
 */
export function buildCategoryChips(categories: CategoryLike[], limit?: number): CategoryChip[] {
  const list =
    categories.length > 0
      ? categories
          .filter((c) => c.slug !== ALL_CATEGORY)
          .map((c) => ({slug: c.slug, name: c.name}))
      : CATEGORY_FALLBACK.map((c) => ({...c}));
  const trimmed = limit == null ? list : list.slice(0, limit);
  return [{slug: ALL_CATEGORY, name: '最新'}, ...trimmed];
}

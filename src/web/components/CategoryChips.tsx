import {useMemo} from 'react';
import {useBrowseStore} from '../stores/browse';
import {buildCategoryChips} from '../library/categoryChips';

export interface CategoryChipsProps {
  onPick: (slug: string) => void;
  limit?: number;
}

/** Horizontal category entry rail driven by the shared taxonomy store. */
export function CategoryChips({onPick, limit = 10}: CategoryChipsProps) {
  const categories = useBrowseStore((s) => s.categories);
  const chips = useMemo(
    () => buildCategoryChips(categories, limit).slice(1),
    [categories, limit]
  );

  if (chips.length === 0) return null;

  return (
    <div className="category-rail">
      {chips.map((c) => (
        <button key={`${c.slug}-${c.name}`} className="category-pill" onClick={() => onPick(c.slug)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

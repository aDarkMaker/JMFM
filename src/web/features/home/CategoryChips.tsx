import {useMemo} from 'react';
import styles from './categoryChips.module.css';
import {useBrowseStore} from '@/web/stores/browse';
import {buildCategoryChips} from '@/web/library/categoryChips';

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
    <div className={styles.rail}>
      {chips.map((c) => (
        <button type="button" key={`${c.slug}-${c.name}`} className={styles.pill} onClick={() => onPick(c.slug)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

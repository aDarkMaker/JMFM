import styles from './skeletons.module.css';
import {Skeleton} from '@/web/ui/Skeleton';
import albumCardStyles from './albumCard.module.css';

function AlbumCardSkeleton({count = 6}: {count?: number}) {
  return (
    <div className={[styles.grid, 'grid-cards'].join(' ')} aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className={[albumCardStyles.root, styles.card].join(' ')} key={i}>
          <Skeleton height="auto" radius="sm" style={{aspectRatio: '3 / 4', borderRadius: 0}} />
          <div className={albumCardStyles.info}>
            <Skeleton height={12} radius="pill" />
            <Skeleton height={10} width="60%" radius="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AlbumRowSkeleton({count = 8}: {count?: number}) {
  return (
    <div className={styles.list} aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className={styles.row} key={i}>
          <Skeleton width={68} height="auto" style={{aspectRatio: '3 / 4', flexShrink: 0}} />
          <div className={styles.rowBody}>
            <Skeleton height={12} radius="pill" />
            <Skeleton height={10} width="60%" radius="pill" />
            <Skeleton height={10} width="40%" radius="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HotRailSkeleton({count = 5}: {count?: number}) {
  return (
    <div className={styles.rail} aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className={styles.hotCard} key={i}>
          <Skeleton height="auto" style={{aspectRatio: '3 / 4'}} />
          <Skeleton height={10} width="60%" radius="pill" />
        </div>
      ))}
    </div>
  );
}

function CategoryGridSkeleton({count = 8}: {count?: number}) {
  return (
    <div className={styles.grid} aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <Skeleton key={i} height={76} radius="md" />
      ))}
    </div>
  );
}

function AlbumDetailSkeleton() {
  return (
    <div className={styles.detail} aria-hidden>
      <div className={styles.detailHero}>
        <Skeleton width={116} height="auto" style={{aspectRatio: '3 / 4', flexShrink: 0}} />
        <div className={styles.detailHead}>
          <Skeleton height={18} width="70%" radius="pill" />
          <Skeleton height={10} width="60%" radius="pill" />
          <Skeleton height={10} width="40%" radius="pill" />
        </div>
      </div>
      <Skeleton height={44} radius="pill" />
      <Skeleton height={10} width="60%" radius="pill" />
      {Array.from({length: 5}, (_, i) => (
        <Skeleton key={i} height={40} />
      ))}
    </div>
  );
}

export {
  AlbumCardSkeleton,
  AlbumRowSkeleton,
  HotRailSkeleton,
  CategoryGridSkeleton,
  AlbumDetailSkeleton,
};

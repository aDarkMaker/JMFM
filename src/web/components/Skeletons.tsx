export function AlbumCardSkeleton({count = 6}: {count?: number}) {
  return (
    <div className="grid-cards skeleton-grid" aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className="album-card skeleton-card" key={i}>
          <div className="skeleton-block skeleton-cover" />
          <div className="album-info">
            <div className="skeleton-block skeleton-line" />
            <div className="skeleton-block skeleton-line skeleton-line-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlbumRowSkeleton({count = 8}: {count?: number}) {
  return (
    <div className="album-list skeleton-list" aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className="album-row skeleton-row" key={i}>
          <div className="skeleton-block skeleton-row-cover" />
          <div className="album-row-body">
            <div className="skeleton-block skeleton-line" />
            <div className="skeleton-block skeleton-line skeleton-line-sm" />
            <div className="skeleton-block skeleton-line skeleton-line-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HotRailSkeleton({count = 5}: {count?: number}) {
  return (
    <div className="hot-rail skeleton-rail" aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className="hot-card" key={i}>
          <div className="skeleton-block hot-cover" />
          <div className="skeleton-block skeleton-line skeleton-line-sm" />
        </div>
      ))}
    </div>
  );
}

export function CategoryGridSkeleton({count = 8}: {count?: number}) {
  return (
    <div className="category-grid skeleton-grid" aria-hidden>
      {Array.from({length: count}, (_, i) => (
        <div className="skeleton-block skeleton-tile" key={i} />
      ))}
    </div>
  );
}

export function AlbumDetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-hidden>
      <div className="detail-hero">
        <div className="skeleton-block detail-skeleton-cover" />
        <div className="detail-head">
          <div className="skeleton-block skeleton-line skeleton-line-lg" />
          <div className="skeleton-block skeleton-line skeleton-line-sm" />
          <div className="skeleton-block skeleton-line skeleton-line-xs" />
        </div>
      </div>
      <div className="skeleton-block detail-skeleton-action" />
      <div className="skeleton-block skeleton-line skeleton-line-sm" />
      {Array.from({length: 5}, (_, i) => (
        <div className="skeleton-block detail-skeleton-ep" key={i} />
      ))}
    </div>
  );
}

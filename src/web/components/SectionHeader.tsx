export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({title, actionLabel, onAction}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <span className="section-header-title">{title}</span>
      {actionLabel ? (
        <button className="section-header-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

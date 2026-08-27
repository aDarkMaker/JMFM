export interface ProgressBarProps {
  progress: number;
  status?: 'pending' | 'running' | 'paused' | 'done' | 'error';
  size?: 'md' | 'sm';
  showLabel?: boolean;
  indeterminate?: boolean;
}

export function ProgressBar({
  progress,
  status,
  size = 'md',
  showLabel = false,
  indeterminate = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const cls = [
    status === 'done' ? 'is-done' : '',
    status === 'error' ? 'is-error' : '',
    status === 'paused' ? 'is-paused' : '',
    indeterminate ? 'is-indeterminate' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`progress-wrap${size === 'sm' ? ' is-sm' : ''}`}>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clamped}
      >
        <div
          className={`progress-fill ${cls}`.trim()}
          style={indeterminate ? undefined : {width: `${clamped}%`}}
        />
      </div>
      {showLabel ? (
        <span className="progress-label">{indeterminate ? '准备中…' : `${clamped}%`}</span>
      ) : null}
    </div>
  );
}

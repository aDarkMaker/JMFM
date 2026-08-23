export interface ProgressBarProps {
  progress: number;
  status?: 'pending' | 'running' | 'paused' | 'done' | 'error';
}

export function ProgressBar({progress, status}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const cls =
    status === 'done' ? 'is-done' : status === 'error' ? 'is-error' : '';
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={clamped}>
      <div className={`progress-fill ${cls}`} style={{width: `${clamped}%`}} />
    </div>
  );
}

import type {ReactNode} from 'react';
import styles from './dialog.module.css';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export interface DialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  actions: DialogAction[];
  /** Backdrop / escape dismissal is ignored while locked. */
  locked?: boolean;
  onClose?: () => void;
  messageEllipsis?: boolean;
}

export function Dialog({
  open,
  title,
  message,
  actions,
  locked = false,
  onClose,
  messageEllipsis = false,
}: DialogProps) {
  if (!open) return null;

  const dismiss = () => {
    if (!locked) onClose?.();
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={dismiss}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jmfm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="jmfm-dialog-title" className={styles.title}>
          {title}
        </h2>
        {message != null ? (
          <div className={[styles.message, messageEllipsis ? styles.ellipsis : ''].filter(Boolean).join(' ')}>
            {message}
          </div>
        ) : null}
        <div className={styles.actions}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={[styles.button, styles[action.variant ?? 'secondary']].filter(Boolean).join(' ')}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

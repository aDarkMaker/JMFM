import {t} from '@/web/i18n';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import styles from './confirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string | null;
  danger?: boolean;
  messageEllipsis?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CLOSE_MS = 160;

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.cancel'),
  danger = false,
  messageEllipsis = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setClosing(false);
      closingRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = (fn?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(() => {
      closingRef.current = false;
      fn?.();
    }, CLOSE_MS);
  };

  if (!open) return null;

  return (
    <div
      className={[styles.overlay, closing ? styles.closing : ''].filter(Boolean).join(' ')}
      role="presentation"
      onClick={() => dismiss(onCancel)}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <div className={[styles.message, messageEllipsis ? styles.ellipsis : ''].filter(Boolean).join(' ')}>
          {message}
        </div>        <div className={styles.actions}>
          {cancelLabel != null ? (
            <button
              type="button"
              className={[styles.button, styles.secondary].join(' ')}
              onClick={() => dismiss(onCancel)}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={[styles.button, danger ? styles.danger : styles.primary].join(' ')}
            onClick={() => dismiss(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

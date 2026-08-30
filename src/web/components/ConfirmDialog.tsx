import {useEffect, useRef, useState} from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
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
  confirmLabel = '确定',
  cancelLabel = '取消',
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
      className={`confirm-overlay${closing ? ' is-closing' : ''}`}
      role="presentation"
      onClick={() => dismiss(onCancel)}
    >
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-title">
          {title}
        </h2>
        <p className={`confirm-message${messageEllipsis ? ' is-ellipsis' : ''}`}>{message}</p>
        <div className="confirm-actions">
          {cancelLabel != null ? (
            <button
              type="button"
              className="confirm-btn confirm-btn-secondary"
              onClick={() => dismiss(onCancel)}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`confirm-btn confirm-btn-primary${danger ? ' is-danger' : ''}`}
            onClick={() => dismiss(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

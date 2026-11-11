import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import styles from './sheet.module.css';

const CLOSE_MS = 200;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Prevents backdrop/escape dismissal (destructive confirmation in flight). */
  locked?: boolean;
}

export function Sheet({open, onClose, title, children, locked = false}: SheetProps) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mounted, locked, onClose]);

  if (!mounted) return null;

  const requestClose = () => {
    if (locked) return;
    setClosing(true);
    onClose();
  };

  return (
    <div
      className={[styles.overlay, closing ? styles.closing : ''].filter(Boolean).join(' ')}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.handle} aria-hidden />
        {title ? <span className={styles.title}>{title}</span> : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

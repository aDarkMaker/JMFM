import {useEffect, useRef, useState} from 'react';
import type {ToastItem} from '@/web/stores/toast';
import {showToast, useToastStore} from '@/web/stores/toast';
import styles from './toast.module.css';
import {Icon} from '@/web/shared/Icon';

const TOAST_MS = 2600;
const TOAST_OUT_MS = 180;

function ToastCard({item, onDone}: {item: ToastItem; onDone: (id: number) => void}) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setLeaving(true), TOAST_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, onDone]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => onDone(item.id), TOAST_OUT_MS);
    return () => clearTimeout(t);
  }, [leaving, item.id, onDone]);

  const icon = item.type === 'success' ? 'check-circle' : item.type === 'error' ? 'warning' : 'info';

  return (
    <div
      className={[styles.toast, styles[item.type], leaving ? styles.leaving : ''].filter(Boolean).join(' ')}
      role="status"
    >
      <span className={styles.icon} aria-hidden>
        <Icon name={icon} size={18} />
      </span>
      <span className={styles.message}>{item.message}</span>
      {item.action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            item.action!.onPress();
            onDone(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className={styles.host} aria-live="polite">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDone={dismiss} />
      ))}
    </div>
  );
}

export {showToast};

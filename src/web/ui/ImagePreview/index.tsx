import {t} from '@/web/i18n';
import {useEffect} from 'react';
import styles from './imagePreview.module.css';
import {IconButton} from '@/web/ui/IconButton';
import {Icon} from '@/web/shared/Icon';

export interface ImagePreviewProps {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImagePreview({open, src, alt = t('common.imagePreview'), onClose}: ImagePreviewProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <div className={styles.close}>
        <IconButton label={t('common.close')} variant="soft" onClick={onClose}>
          <Icon name="close" size={22} />
        </IconButton>
      </div>
      <img className={styles.image} src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

import type {RefObject} from 'react';
import {t} from '@/web/i18n';
import {IconButton} from '@/web/ui/IconButton';
import {Input} from '@/web/ui/Input';
import {Icon} from '@/web/shared/Icon';
import styles from './reader.module.css';

export interface ReaderToolbarProps {
  title: string;
  page: number;
  total: number;
  pageInput: string;
  inputWrapRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPageInput: (raw: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}

export function ReaderToolbar({
  title,
  page,
  total,
  pageInput,
  inputWrapRef,
  onClose,
  onPageInput,
  onPrev,
  onNext,
  onZoomOut,
  onZoomIn,
  onFit,
}: ReaderToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <IconButton label={t('common.back')} onClick={onClose}>
        <Icon name="arrow-back" size={20} />
      </IconButton>
      <span className={styles.title}>{title}</span>
      <div className={styles.group}>
        <IconButton label={t('reader.prev')} size="sm" disabled={page <= 1} onClick={onPrev}>
          <Icon name="chevron-left" size={20} />
        </IconButton>
        <div ref={inputWrapRef}>
          <Input
            className={styles.pageInput}
            value={pageInput}
            onChange={onPageInput}
            inputMode="numeric"
            aria-label={t('reader.page')}
          />
        </div>
        <span className={styles.total}>/ {total || '-'}</span>
        <IconButton label={t('reader.next')} size="sm" disabled={total > 0 && page >= total} onClick={onNext}>
          <Icon name="chevron-right" size={20} />
        </IconButton>
      </div>
      <div className={styles.group}>
        <IconButton label={t('reader.zoomOut')} size="sm" onClick={onZoomOut}>
          <Icon name="zoom-out" size={18} />
        </IconButton>
        <IconButton label={t('reader.zoomIn')} size="sm" onClick={onZoomIn}>
          <Icon name="zoom-in" size={18} />
        </IconButton>
        <IconButton label={t('reader.fit')} size="sm" onClick={onFit}>
          <Icon name="visibility" size={18} />
        </IconButton>
      </div>
    </div>
  );
}

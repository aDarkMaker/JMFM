import type {AlbumDetail} from '@/core/model';
import {t} from '@/web/i18n';
import {Button} from '@/web/ui/Button';
import {Icon} from '@/web/shared/Icon';
import styles from './detail.module.css';

function formatCount(n: number | undefined): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 10000) return t('common.wan', {value: (n / 10000).toFixed(1)});
  return String(n);
}

export interface DetailHeroProps {
  detail: AlbumDetail;
}

export function DetailHero({detail}: DetailHeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroBg} aria-hidden />
      <div className={styles.cover}>
        {detail.coverUrl ? <img src={detail.coverUrl} alt="" decoding="async" /> : null}
      </div>
      <div className={styles.head}>
        <h1 className={styles.title}>{detail.name}</h1>
        {detail.author ? <span className={styles.author}>{detail.author}</span> : null}
        <div className={styles.stats}>
          <span>{t('detail.episodes', {count: detail.episodes.length})}</span>
          {detail.pageCount ? <span>{t('detail.pages', {count: detail.pageCount})}</span> : null}
          {formatCount(detail.likesCount) ? (
            <span>{t('detail.favorites', {count: formatCount(detail.likesCount) ?? ''})}</span>
          ) : null}
          {formatCount(detail.viewsCount) ? (
            <span>{t('detail.views', {count: formatCount(detail.viewsCount) ?? ''})}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface DetailActionsProps {
  local: boolean;
  downloaded: boolean;
  hasHistory: boolean;
  resumePage: number;
  onRead: () => void;
  onDownload: () => void;
}

export function DetailActions({
  local,
  downloaded,
  hasHistory,
  resumePage,
  onRead,
  onDownload,
}: DetailActionsProps) {
  const readIcon = local ? (hasHistory ? 'play-arrow' : 'auto-stories') : 'visibility';
  const readLabel = local
    ? hasHistory
      ? t('detail.continueReading', {page: resumePage})
      : t('detail.read')
    : hasHistory
      ? t('detail.previewPage', {page: resumePage})
      : t('detail.preview');

  return (
    <div className={styles.actions}>
      <Button
        className={styles.readAction}
        size="lg"
        iconLeft={<Icon name={readIcon} size={20} />}
        onClick={onRead}
      >
        {readLabel}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        disabled={downloaded || local}
        iconLeft={<Icon name={local ? 'download-done' : downloaded ? 'sync' : 'download'} size={18} />}
        onClick={onDownload}
      >
        {local ? t('detail.inLibrary') : downloaded ? t('tasks.statusRunning') : t('detail.download')}
      </Button>
    </div>
  );
}

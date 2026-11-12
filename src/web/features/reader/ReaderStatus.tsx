import {t} from '@/web/i18n';
import {Button} from '@/web/ui/Button';
import {Spinner} from '@/web/ui/Spinner';
import styles from './reader.module.css';

export interface ReaderStatusProps {
  error: string | null;
  pages: number;
  onRetry: () => void;
}

export function ReaderStatus({error, pages, onRetry}: ReaderStatusProps) {
  if (error) {
    return (
      <div className={styles.error}>
        <span>{t('reader.openError', {error})}</span>
        <div className={styles.errorActions}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }
  if (pages === 0) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} />
        <span>{t('reader.loading')}</span>
      </div>
    );
  }
  return null;
}

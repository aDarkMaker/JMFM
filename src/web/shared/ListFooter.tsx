import {t} from '@/web/i18n';
import type {Ref} from 'react';
import styles from './listFooter.module.css';
import {Spinner} from '@/web/ui/Spinner';

export interface ListFooterProps {
  sentinelRef?: Ref<HTMLDivElement>;
  loading?: boolean;
  end?: boolean;
  /** Hide the end text when the list never had items. */
  showEnd?: boolean;
  endLabel?: string;
  loadingLabel?: string;
}

/** Infinite-scroll tail: intersection sentinel + spinner + end-of-list note. */
export function ListFooter({
  sentinelRef,
  loading = false,
  end = false,
  showEnd = true,
  endLabel = t('common.noMore'),
  loadingLabel = t('common.loading'),
}: ListFooterProps) {
  return (
    <div ref={sentinelRef} className={styles.sentinel}>
      {loading ? <Spinner size={18} label={loadingLabel} /> : null}
      {end && showEnd ? <span className={styles.end}>{endLabel}</span> : null}
    </div>
  );
}

import {useMemo} from 'react';
import {Dialog} from '@/web/ui/Dialog';
import {ProgressBar} from '@/web/ui/ProgressBar';
import {t} from '@/web/i18n';
import type {useAppUpdate} from '@/web/hooks/useAppUpdate';
import {ReleaseNotes} from './ReleaseNotes';
import styles from './updatePrompt.module.css';

export type UpdateApi = ReturnType<typeof useAppUpdate>;

export interface UpdatePromptProps {
  open: boolean;
  update: UpdateApi;
  onClose?: () => void;
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) {
    return '';
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatePrompt({open, update, onClose}: UpdatePromptProps) {
  const {
    status,
    progress,
    force,
    apkSize,
    currentVersion,
    latestVersion,
    latestNotes,
    mirrorIndex,
    source,
    error,
    downloadAndInstall,
  } = update;

  const size = formatSize(apkSize);
  const stale = source === 'cache';
  const switching = status === 'downloading' && mirrorIndex > 0;
  const busy = status === 'downloading' || status === 'installing';

  const message = useMemo(() => {
    const head = t('update.newVersionPrompt', {
      current: currentVersion,
      latest: latestVersion ?? '',
    });
    return (
      <span className={styles.body}>
        <span className={styles.versions}>{head}</span>
        {size || stale || switching ? (
          <span className={styles.metaRow}>
            {size ? <span className={styles.meta}>{t('update.packageSize', {size})}</span> : null}
            {stale ? <span className={styles.meta}>{t('update.stale')}</span> : null}
            {switching ? <span className={styles.meta}>{t('update.mirrorSwitching')}</span> : null}
          </span>
        ) : null}
        <ReleaseNotes notes={latestNotes} />
        {busy ? (
          <span className={styles.progress}>
            <ProgressBar
              progress={progress}
              status="running"
              showLabel={status === 'downloading'}
              indeterminate={status === 'installing'}
            />
          </span>
        ) : null}
        {error ? <span className={styles.error}>{error}</span> : null}
      </span>
    );
  }, [currentVersion, latestVersion, size, stale, switching, latestNotes, busy, status, progress, error]);

  return (
    <Dialog
      open={open}
      title={force ? t('update.forceTitle') : t('update.newVersion')}
      message={message}
      locked={force}
      onClose={force ? undefined : onClose}
      actions={[
        ...(force
          ? []
          : [{label: t('update.later'), onClick: () => onClose?.(), disabled: busy}]),
        {
          label: busy ? t('update.installing') : t('update.downloadAndInstall'),
          variant: 'primary' as const,
          disabled: busy,
          onClick: () => {
            void downloadAndInstall().catch(() => undefined);
          },
        },
      ]}
    />
  );
}

import {t} from '@/web/i18n';
import {useState, type ReactNode} from 'react';
import {ConfirmDialog} from '@/web/ui/ConfirmDialog';
import {ProgressBar} from '@/web/ui/ProgressBar';
import {ListGroup} from '@/web/ui/ListGroup';
import {ListTile} from '@/web/ui/ListTile';
import {showToast} from '@/web/ui/Toast';
import {useLibraryStore} from '@/web/stores/library';
import {useRepairStore} from '@/web/stores/repair';
import {useAppUpdate} from '@/web/hooks/useAppUpdate';
import {useUpdateStore} from '@/web/stores/update';
import {ReleaseNotes} from '@/web/features/update/ReleaseNotes';
import type {RepairOutcome} from '../useLibraryRepair';
import {useLibraryRepair} from '../useLibraryRepair';
import styles from '../settings.module.css';

interface DialogState {
  title: string;
  message: ReactNode;
  kind: 'alert' | 'repair';
  payload?: RepairOutcome;
}

export interface MaintenanceSectionProps {
  imageFormat: string;
}

export function MaintenanceSection({imageFormat}: MaintenanceSectionProps) {
  const libraryItems = useLibraryStore((s) => s.items);
  const {runRepair, handleRepair} = useLibraryRepair(imageFormat);
  const repairPhase = useRepairStore((s) => s.phase);
  const repairDone = useRepairStore((s) => s.done);
  const repairTotal = useRepairStore((s) => s.total);
  const repairMessage = useRepairStore((s) => s.message);
  const {currentVersion, status, progress, canInstallInApp, checkUpdate} = useAppUpdate();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const applyOutcome = (outcome: RepairOutcome) => {
    if (outcome.kind === 'none') {
      showToast(t('repair.none'), 'info');
      return;
    }
    if (outcome.kind === 'alert') {
      setDialog({kind: 'alert', title: outcome.title, message: outcome.message});
      return;
    }
    setDialog({
      kind: 'repair',
      title: t('repair.title'),
      message: t('settings.repairConfirm', {count: outcome.count}),
      payload: outcome,
    });
  };

  const handleCheckUpdate = async () => {
    const result = await checkUpdate();
    if (result.kind === 'up-to-date') {
      setDialog({
        kind: 'alert',
        title: t('settings.checkUpdate'),
        message: t('update.upToDate', {version: result.current}),
      });
      return;
    }
    if (result.kind === 'error') {
      setDialog({
        kind: 'alert',
        title: t('update.checkFailed'),
        message: result.error ?? t('update.unknown'),
      });
      return;
    }
    if (!canInstallInApp) {
      setDialog({
        kind: 'alert',
        title: t('update.newVersion'),
        message: (
          <span className={styles.dialogBody}>
            <span>
              {t('update.newVersionNote', {latest: result.latest ?? '', current: result.current})}
            </span>
            <ReleaseNotes notes={result.releaseNotes} />
            <span className={styles.dialogHint}>{t('update.androidOnly')}</span>
          </span>
        ),
      });
      return;
    }
    setDialog(null);
    useUpdateStore.getState().setPromptOpen(true);
  };

  const updateSubtitle =
    status === 'checking'
      ? t('update.checking')
      : status === 'downloading'
        ? t('update.downloading', {percent: progress})
        : status === 'installing'
          ? t('update.installing')
          : canInstallInApp
            ? t('update.githubSubtitle')
            : t('update.androidOnly');

  const confirm = () => {
    if (dialog?.kind === 'repair' && dialog.payload?.kind === 'confirm') {
      const payload = dialog.payload.issues;
      setDialog(null);
      void runRepair(payload).then(applyOutcome);
      return;
    }
    setDialog(null);
  };

  return (
    <>
      <ListGroup title={t('settings.general')}>
        <ListTile
          variant="plain"
          icon="healing"
          title={t('settings.repair')}
          subtitle={repairPhase === 'scanning' ? t('settings.repairing') : t('settings.repairHint')}
          loading={repairPhase === 'scanning'}
          onClick={() => void handleRepair(libraryItems).then(applyOutcome)}
        />
        {repairPhase === 'scanning' ? (
          <div className={styles.progress}>
            <ProgressBar
              progress={repairTotal > 0 ? Math.round((repairDone / repairTotal) * 100) : 0}
              status="running"
              indeterminate={repairTotal === 0}
            />
            <span className={styles.progressHint}>
              {t('settings.scanProgress', {done: repairDone, total: repairTotal})}
            </span>
          </div>
        ) : repairPhase === 'queued' ? (
          <div className={styles.progress}>
            <span className={styles.progressHint}>{repairMessage}</span>
          </div>
        ) : null}
        <ListTile
          variant="plain"
          icon="update"
          title={t('settings.checkUpdate')}
          subtitle={updateSubtitle}
          loading={status === 'checking'}
          onClick={() => void handleCheckUpdate()}
        />
        {(status === 'downloading' || status === 'installing') && (
          <div className={styles.progress}>
            <ProgressBar
              progress={progress}
              status="running"
              showLabel={status === 'downloading'}
              indeterminate={status === 'installing'}
            />
          </div>
        )}
        <ListTile
          variant="plain"
          icon="info"
          title={t('settings.about')}
          subtitle={`JMFM v${currentVersion || '…'}`}
        />
      </ListGroup>
      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.kind === 'repair' ? t('common.add') : t('common.confirm')}
        cancelLabel={dialog?.kind === 'alert' ? null : t('common.cancel')}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

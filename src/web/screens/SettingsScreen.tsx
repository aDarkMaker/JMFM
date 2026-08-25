import {useCallback, useEffect, useState} from 'react';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {useSettingsStore} from '../stores/settings';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {useDownloadStore} from '../stores/download';
import {ListTile} from '../components/ListTile';
import {SectionHeader} from '../components/SectionHeader';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {createRuntime} from '../../core/download/runtime';
import {scanLibraryRepair, repairLibraryItems} from '../library/repairLibrary';
import {useDownloadTask} from '../hooks/useDownloadTask';

const JMF_DIR = 'JMFDownloads';

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type DialogState =
  | {mode: 'alert'; title: string; message: string}
  | {
      mode: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      payload: LibraryItem[];
    };

export function SettingsScreen() {
  const loaded = useSettingsStore(s => s.loaded);
  const load = useSettingsStore(s => s.load);
  const settings = useSettingsStore(s => s.settings);
  const update = useSettingsStore(s => s.update);
  const libraryItems = useLibraryStore(s => s.items);
  const addBatch = useDownloadStore(s => s.addBatch);
  const {startDownload} = useDownloadTask();

  const [newDomain, setNewDomain] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState<{done: number; total: number} | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  const handlePickDirectory = async () => {
    try {
      const result = await FilePicker.pickDirectory();
      if (!result?.path) {
        return;
      }
      const name =
        result.path.split('/').filter(Boolean).pop()?.split(':').pop() || '已选目录';
      void update({downloadPath: `${name}/${JMF_DIR}`});
    } catch (err) {
      console.error('Failed to pick directory:', err);
    }
  };

  const handleAddDomain = () => {
    const value = newDomain.trim();
    if (!value) {
      return;
    }
    if (!settings.domains.includes(value)) {
      void update({domains: [...settings.domains, value]});
    }
    setNewDomain('');
  };

  const handleDomainChange = (index: number, value: string) => {
    const next = [...settings.domains];
    next[index] = value;
    void update({domains: next});
  };

  const runRepair = useCallback(
    async (needsRepair: LibraryItem[]) => {
      setRepairing(true);
      try {
        const runtime = createRuntime();
        await repairLibraryItems(needsRepair, runtime.fs, (done, t) => {
          setRepairProgress({done, total: t});
        });

        const tasks = needsRepair.map(item => ({
          id: uid(),
          albumId: item.albumId,
          title: item.title,
        }));
        for (const item of needsRepair) {
          const existing = useDownloadStore.getState().tasks.find(t => t.albumId === item.albumId);
          if (existing) {
            existing.controller?.cancel();
            useDownloadStore.getState().remove(existing.id);
          }
        }
        addBatch(tasks);
        for (const t of tasks) {
          const added = useDownloadStore.getState().tasks.find(x => x.id === t.id);
          if (added) {
            startDownload(added.id);
          }
        }
        setDialog({
          mode: 'alert',
          title: '资源修复',
          message: `已将 ${needsRepair.length} 本加入下载队列，可到任务页查看进度`,
        });
      } catch (err) {
        setDialog({
          mode: 'alert',
          title: '修复失败',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setRepairing(false);
        setRepairProgress(null);
      }
    },
    [addBatch, startDownload],
  );

  const handleRepair = useCallback(async () => {
    if (repairing) return;
    if (libraryItems.length === 0) {
      setDialog({mode: 'alert', title: '资源修复', message: '漫画库为空，无需修复'});
      return;
    }
    setRepairing(true);
    try {
      const {compliant, needsRepair} = await scanLibraryRepair(
        libraryItems,
        settings.imageFormat,
      );
      const total = libraryItems.length;
      const m = needsRepair.length;
      if (m === 0) {
        setDialog({
          mode: 'alert',
          title: '资源修复',
          message: `所有资源已是最新格式（共 ${total} 本）`,
        });
        return;
      }
      setDialog({
        mode: 'confirm',
        title: '资源修复',
        message: `共 ${total} 本，需修复 ${m} 本（已合规 ${compliant} 本），是否开始？\n修复将删除旧文件并重新下载。`,
        confirmLabel: '开始修复',
        payload: needsRepair,
      });
    } catch (err) {
      setDialog({
        mode: 'alert',
        title: '修复失败',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRepairing(false);
      setRepairProgress(null);
    }
  }, [repairing, libraryItems, settings.imageFormat]);

  return (
    <div className="app-screen">
      <SectionHeader title="设置" />
      <div className="settings-stack">
        <div className="settings-group">
          <span className="settings-group-title">显示</span>
          <ListTile
            icon={settings.theme === 'dark' ? 'dark-mode' : 'light-mode'}
            title="主题"
            trailing={
              <div className="theme-segmented">
                <button
                  className={`theme-segmented-item${settings.theme === 'light' ? ' is-active' : ''}`}
                  onClick={() => void update({theme: 'light'})}>
                  Light
                </button>
                <button
                  className={`theme-segmented-item${settings.theme === 'dark' ? ' is-active' : ''}`}
                  onClick={() => void update({theme: 'dark'})}>
                  Dark
                </button>
              </div>
            }
          />
          <ListTile
            icon="swipe-vertical"
            title="阅读方式"
            trailing={
              <div className="theme-segmented">
                <button
                  className={`theme-segmented-item${settings.readerMode === 'scroll' ? ' is-active' : ''}`}
                  onClick={() => void update({readerMode: 'scroll'})}>
                  上下滚动
                </button>
                <button
                  className={`theme-segmented-item${settings.readerMode === 'paged' ? ' is-active' : ''}`}
                  onClick={() => void update({readerMode: 'paged'})}>
                  左右滑动
                </button>
              </div>
            }
          />
        </div>
        <div className="settings-group">
          <span className="settings-group-title">下载</span>
          <ListTile
            icon="folder"
            title="下载路径"
            inputValue={settings.downloadPath}
            inputPlaceholder="JMFMobile/downloads"
            inputReadOnly
            onClick={() => void handlePickDirectory()}
            onInputChange={v => void update({downloadPath: v})}
          />
        </div>
        <div className="settings-group">
          <span className="settings-group-title">网络</span>
          <ListTile
            icon="network-check"
            title="启用代理"
            subtitle="通过代理服务器访问"
            toggleValue={settings.proxyEnabled}
            onToggleChange={v => void update({proxyEnabled: v})}
          />
          <div className="domain-list">
            {settings.domains.map((domain, index) => (
              <div className="domain-item" key={index}>
                <input
                  className="domain-input"
                  type="text"
                  value={domain}
                  disabled={index < 5}
                  onChange={e => handleDomainChange(index, e.target.value)}
                />
                {index >= 5 ? (
                  <button
                    className="domain-remove"
                    onClick={() => {
                      const next = settings.domains.filter((_, i) => i !== index);
                      void update({domains: next});
                    }}>
                    ×
                  </button>
                ) : (
                  <span className="domain-badge">默认</span>
                )}
              </div>
            ))}
            <div className="domain-add">
              <input
                className="domain-input"
                type="text"
                placeholder="添加自定义网址"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAddDomain();
                  }
                }}
              />
              <button className="domain-add-btn" onClick={handleAddDomain}>
                添加
              </button>
            </div>
          </div>
        </div>
        <div className="settings-group">
          <span className="settings-group-title">通用</span>
          <ListTile
            icon="build"
            title="资源修复"
            subtitle={
              repairing && repairProgress
                ? `清理中 ${repairProgress.done}/${repairProgress.total}`
                : repairing
                  ? '扫描中…'
                  : '将不符合格式的漫画重新下载'
            }
            onClick={() => void handleRepair()}
          />
          <ListTile
            icon="info"
            title="关于"
            subtitle="JMFM v0.1.0"
            trailing="chevron-right"
          />
        </div>
      </div>
      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.mode === 'confirm' ? dialog.confirmLabel ?? '确定' : '确定'}
        cancelLabel={dialog?.mode === 'confirm' ? '取消' : null}
        danger={dialog?.mode === 'confirm' ? dialog.danger : false}
        onConfirm={() => {
          if (dialog?.mode === 'confirm') {
            const payload = dialog.payload;
            setDialog(null);
            void runRepair(payload);
            return;
          }
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

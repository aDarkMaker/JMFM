import {useEffect, useState} from 'react';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {useSettingsStore} from '../stores/settings';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {parsePickedDirectory} from '../library/resolveLibraryPaths';
import {ListTile} from '../components/ListTile';
import {SectionHeader} from '../components/SectionHeader';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {isHardBlockedKeyword} from '../../core/model/blocklist';
import {useLibraryRepair, RepairOutcome} from '../hooks/useLibraryRepair';
import {useAppUpdate} from '../hooks/useAppUpdate';
import {ProgressBar} from '../components/ProgressBar';
import type {Defect} from '../library/repairLibrary';

type DialogState =
  | {mode: 'alert'; title: string; message: string}
  | {
      mode: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      payload: {item: LibraryItem; defects: Defect[]}[];
    }
  | {mode: 'update'; title: string; message: string};

export function SettingsScreen() {
  const loaded = useSettingsStore(s => s.loaded);
  const load = useSettingsStore(s => s.load);
  const settings = useSettingsStore(s => s.settings);
  const update = useSettingsStore(s => s.update);
  const libraryItems = useLibraryStore(s => s.items);
  const {repairing, repairProgress, runRepair, handleRepair} =
    useLibraryRepair(settings.imageFormat);
  const {
    currentVersion,
    status: updateStatus,
    progress: updateProgress,
    canInstallInApp,
    checkUpdate,
    downloadAndInstall,
  } = useAppUpdate();

  const [newDomain, setNewDomain] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newWhitelistTag, setNewWhitelistTag] = useState('');
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
      void update({downloadPath: parsePickedDirectory(result.path)});
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

  const handleAddTag = () => {
    const value = newTag.trim();
    if (!value) {
      return;
    }
    if (isHardBlockedKeyword(value)) {
      setNewTag('');
      return;
    }
    if (!settings.blacklistTags.includes(value)) {
      void update({blacklistTags: [...settings.blacklistTags, value]});
    }
    setNewTag('');
  };

  const handleAddWhitelistTag = () => {
    const value = newWhitelistTag.trim();
    if (!value) {
      return;
    }
    if (isHardBlockedKeyword(value)) {
      setNewWhitelistTag('');
      return;
    }
    if (!settings.whitelistTags.includes(value)) {
      void update({whitelistTags: [...settings.whitelistTags, value]});
    }
    setNewWhitelistTag('');
  };

  const applyRepairOutcome = (outcome: RepairOutcome) => {
    switch (outcome.kind) {
      case 'none':
        return;
      case 'alert':
        setDialog({mode: 'alert', title: outcome.title, message: outcome.message});
        return;
      case 'confirm':
        setDialog({
          mode: 'confirm',
          title: '修复文件',
          message: `共 ${outcome.total} 本，需修复 ${outcome.count} 本（已合规 ${outcome.compliant} 本），是否开始？\n将补齐缺失的页面与封面，尽量无需重新下载整本。`,
          confirmLabel: '开始修复',
          payload: outcome.issues,
        });
        return;
    }
  };

  const handleRepairClick = async () => {
    const outcome = await handleRepair(libraryItems);
    applyRepairOutcome(outcome);
  };

  const handleCheckUpdate = async () => {
    const result = await checkUpdate();
    if (result.kind === 'up-to-date') {
      setDialog({
        mode: 'alert',
        title: '检查更新',
        message: `当前已是最新版本（v${result.current}）`,
      });
      return;
    }
    if (result.kind === 'error') {
      setDialog({
        mode: 'alert',
        title: '检查更新失败',
        message: result.error ?? '未知错误',
      });
      return;
    }
    const notes = result.releaseNotes ? `\n\n${result.releaseNotes}` : '';
    if (!canInstallInApp) {
      setDialog({
        mode: 'alert',
        title: '发现新版本',
        message: `最新 v${result.latest}（当前 v${result.current}）${notes}\n\n应用内安装仅支持 Android。`,
      });
      return;
    }
    setDialog({
      mode: 'update',
      title: '发现新版本',
      message: `当前 v${result.current} → 最新 v${result.latest}${notes}`,
    });
  };

  const updateSubtitle =
    updateStatus === 'checking'
      ? '正在检查…'
      : updateStatus === 'downloading'
        ? `下载中 ${updateProgress}%`
        : updateStatus === 'installing'
          ? '正在打开安装程序…'
          : canInstallInApp
            ? '从 GitHub 获取最新 APK'
            : '仅 Android 支持应用内安装';

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
          <span className="settings-group-title">内容过滤</span>
          <span className="settings-hint">
            黑名单命中不会出现或被下载；白名单优先推荐
          </span>
          <div className="domain-list">
            {settings.blacklistTags.map((tag, index) => (
              <div className="domain-item" key={index}>
                <span className="tag-blacklist-chip">{tag}</span>
                <button
                  className="domain-remove"
                  aria-label={`移除 ${tag}`}
                  onClick={() => {
                    const next = settings.blacklistTags.filter((_, i) => i !== index);
                    void update({blacklistTags: next});
                  }}>
                  ×
                </button>
              </div>
            ))}
            <div className="domain-add">
              <input
                className="domain-input"
                type="text"
                placeholder="添加黑名单标签"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAddTag();
                  }
                }}
              />
              <button className="domain-add-btn" onClick={handleAddTag}>
                添加
              </button>
            </div>
          </div>
          <span className="settings-hint">白名单标签</span>
          <div className="domain-list">
            {settings.whitelistTags.map((tag, index) => (
              <div className="domain-item" key={index}>
                <span className="tag-whitelist-chip">{tag}</span>
                <button
                  className="domain-remove"
                  aria-label={`移除 ${tag}`}
                  onClick={() => {
                    const next = settings.whitelistTags.filter((_, i) => i !== index);
                    void update({whitelistTags: next});
                  }}>
                  ×
                </button>
              </div>
            ))}
            <div className="domain-add">
              <input
                className="domain-input"
                type="text"
                placeholder="添加白名单标签"
                value={newWhitelistTag}
                onChange={e => setNewWhitelistTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAddWhitelistTag();
                  }
                }}
              />
              <button className="domain-add-btn" onClick={handleAddWhitelistTag}>
                添加
              </button>
            </div>
          </div>
        </div>
        <div className="settings-group">
          <span className="settings-group-title">通用</span>
          <ListTile
            icon="healing"
            title="修复文件"
            subtitle={
              repairing && repairProgress
                ? `修复中 ${repairProgress.done}/${repairProgress.total}`
                : repairing
                  ? '扫描中…'
                  : '检查并补齐缺失的页面与封面'
            }
            onClick={() => void handleRepairClick()}
          />
          <ListTile
            icon="update"
            title="检查更新"
            subtitle={updateSubtitle}
            onClick={() => void handleCheckUpdate()}
          />
          {(updateStatus === 'downloading' || updateStatus === 'installing') && (
            <div className="settings-update-progress">
              <ProgressBar
                progress={updateProgress}
                status={updateStatus === 'installing' ? 'running' : 'running'}
                showLabel={updateStatus === 'downloading'}
                indeterminate={updateStatus === 'installing'}
              />
            </div>
          )}
          <ListTile
            icon="info"
            title="关于"
            subtitle={`JMFM v${currentVersion || '…'}`}
          />
        </div>
      </div>
      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={
          dialog?.mode === 'confirm'
            ? dialog.confirmLabel ?? '确定'
            : dialog?.mode === 'update'
              ? '下载并安装'
              : '确定'
        }
        cancelLabel={dialog?.mode === 'confirm' || dialog?.mode === 'update' ? '取消' : null}
        danger={dialog?.mode === 'confirm' ? dialog.danger : false}
        onConfirm={() => {
          if (dialog?.mode === 'confirm') {
            const payload = dialog.payload;
            setDialog(null);
            void runRepair(payload).then(applyRepairOutcome);
            return;
          }
          if (dialog?.mode === 'update') {
            setDialog(null);
            void downloadAndInstall().catch(err => {
              setDialog({
                mode: 'alert',
                title: '更新失败',
                message: err instanceof Error ? err.message : String(err),
              });
            });
            return;
          }
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

import {useEffect, useState} from 'react';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {useSettingsStore} from '../stores/settings';
import {useLibraryStore, LibraryItem} from '../stores/library';
import {ListTile} from '../components/ListTile';
import {SectionHeader} from '../components/SectionHeader';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {isHardBlockedKeyword} from '../../core/model/blocklist';
import {useLibraryRepair, RepairOutcome} from '../hooks/useLibraryRepair';

const JMF_DIR = 'JMFDownloads';

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
  const {repairing, repairProgress, runRepair, handleRepair} =
    useLibraryRepair(settings.imageFormat);

  const [newDomain, setNewDomain] = useState('');
  const [newTag, setNewTag] = useState('');
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
          title: '资源修复',
          message: `共 ${outcome.total} 本，需修复 ${outcome.count} 本（已合规 ${outcome.compliant} 本），是否开始？\n修复将删除旧文件并重新下载。`,
          confirmLabel: '开始修复',
          payload: outcome.payload,
        });
        return;
    }
  };

  const handleRepairClick = async () => {
    const outcome = await handleRepair(libraryItems);
    applyRepairOutcome(outcome);
  };

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
            命中标签的漫画不会出现或被下载
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
            onClick={() => void handleRepairClick()}
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
            void runRepair(payload).then(applyRepairOutcome);
            return;
          }
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

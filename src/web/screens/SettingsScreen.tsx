import {useEffect, useState} from 'react';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {useSettingsStore} from '../stores/settings';
import {ListTile} from '../components/ListTile';
import {SectionHeader} from '../components/SectionHeader';

const JMF_DIR = 'JMFDownloads';

export function SettingsScreen() {
  const loaded = useSettingsStore(s => s.loaded);
  const load = useSettingsStore(s => s.load);
  const settings = useSettingsStore(s => s.settings);
  const update = useSettingsStore(s => s.update);

  const [newDomain, setNewDomain] = useState('');

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
          <p className="settings-hint">漫画保存在应用存储中，可通过资源页卡片分享导出（Android 沙箱限制）。</p>
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
            icon="info"
            title="关于"
            subtitle="JMFM v0.1.0"
            trailing="chevron-right"
          />
        </div>
      </div>
    </div>
  );
}

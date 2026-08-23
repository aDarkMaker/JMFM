import {useEffect} from 'react';
import {useSettingsStore} from '../stores/settings';
import {ListTile} from '../components/ListTile';
import {SectionHeader} from '../components/SectionHeader';

export function SettingsScreen() {
  const loaded = useSettingsStore(s => s.loaded);
  const load = useSettingsStore(s => s.load);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  return (
    <div className="app-screen">
      <SectionHeader title="设置" />
      <div className="settings-stack">
        <div className="settings-group">
          <span className="settings-group-title">下载</span>
          <ListTile
            icon="folder"
            title="下载路径"
            subtitle="JMFMobile/downloads"
            trailing="chevron-right"
          />
          <ListTile
            icon="download"
            title="图片格式"
            subtitle="webp"
            trailing="chevron-right"
          />
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

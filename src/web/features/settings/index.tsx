import {t} from '@/web/i18n';
import {useEffect} from 'react';
import {useSettingsStore} from '@/web/stores/settings';
import {SectionHeader} from '@/web/ui/SectionHeader';
import {GeneralSection} from './sections/GeneralSection';
import {DownloadSection} from './sections/DownloadSection';
import {FilterSection} from './sections/FilterSection';
import {MaintenanceSection} from './sections/MaintenanceSection';
import styles from './settings.module.css';

export function SettingsScreen() {
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  return (
    <div className="app-screen">
      <SectionHeader title={t('settings.title')} />
      <div className={styles.stack}>
        <GeneralSection settings={settings} update={update} />
        <DownloadSection settings={settings} update={update} />
        <FilterSection settings={settings} update={update} />
        <MaintenanceSection imageFormat={settings.imageFormat} />
      </div>
    </div>
  );
}

import {t, type MessageKey} from '@/web/i18n';
import {ListGroup} from '@/web/ui/ListGroup';
import {ListTile} from '@/web/ui/ListTile';
import {Segmented} from '@/web/ui/Segmented';
import type {Settings} from '@/data/settings';
import styles from '../settings.module.css';

const THEME_OPTIONS = [
  {value: 'light', label: 'Light'},
  {value: 'dark', label: 'Dark'},
] as const;

const READER_OPTIONS = [
  {value: 'scroll', label: 'settings.readerScroll'},
  {value: 'paged', label: 'settings.readerPaged'},
] as const;

export interface GeneralSectionProps {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

export function GeneralSection({settings, update}: GeneralSectionProps) {
  return (
    <ListGroup title={t('settings.display')}>
      <ListTile
        variant="plain"
        icon={settings.theme === 'dark' ? 'dark-mode' : 'light-mode'}
        title={t('settings.theme')}
        trailing={
          <Segmented
            className={styles.segmented}
            size="sm"
            options={THEME_OPTIONS.map((o) => ({...o}))}
            value={settings.theme}
            onChange={(theme) => update({theme})}
            ariaLabel={t('settings.theme')}
          />
        }
      />
      <ListTile
        variant="plain"
        icon="swipe-vertical"
        title={t('settings.readerMode')}
        trailing={
          <Segmented
            className={styles.segmented}
            size="sm"
            options={READER_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.label as MessageKey),
            }))}
            value={settings.readerMode}
            onChange={(readerMode) => update({readerMode})}
            ariaLabel={t('settings.readerMode')}
          />
        }
      />
    </ListGroup>
  );
}

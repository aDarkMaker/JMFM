import {t} from '@/web/i18n';
import {useState} from 'react';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {ListGroup} from '@/web/ui/ListGroup';
import {ListTile} from '@/web/ui/ListTile';
import {Input} from '@/web/ui/Input';
import {IconButton} from '@/web/ui/IconButton';
import {Badge} from '@/web/ui/Badge';
import {Icon} from '@/web/shared/Icon';
import {showToast} from '@/web/ui/Toast';
import {persistDownloadTreeUri} from '@/core/fs/saf/safStorage';
import {parsePickedDirectory} from '@/web/library/resolveLibraryPaths';
import {useLibraryStore} from '@/web/stores/library';
import {useSettingsStore} from '@/web/stores/settings';
import type {Settings} from '@/data/settings';
import styles from '../settings.module.css';

const DEFAULT_DOMAIN_COUNT = 5;

export interface DownloadSectionProps {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

export function DownloadSection({settings, update}: DownloadSectionProps) {
  const [picking, setPicking] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const pickDirectory = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const result = await FilePicker.pickDirectory();
      if (!result?.path) return;
      await persistDownloadTreeUri(result.path);
      await update({
        downloadPath: parsePickedDirectory(result.path),
        downloadTreeUri: result.path,
      });
      await useLibraryStore.getState().load({force: true});
      showToast(t('settings.pickOk'), 'success');
    } catch (err) {
      console.error('Failed to pick directory:', err);
      showToast(t('settings.pickFailed'), 'error');
    } finally {
      setPicking(false);
    }
  };

  const addDomain = () => {
    const value = newDomain.trim();
    if (!value) return;
    if (!settings.domains.includes(value)) {
      update({domains: [...settings.domains, value]});
    }
    setNewDomain('');
  };

  return (
    <>
      <ListGroup
        title={t('settings.download')}
        hint={settings.downloadTreeUri ? undefined : t('settings.pickPathHint')}
      >
        <ListTile
          variant="plain"
          icon="folder"
          title={t('settings.downloadPath')}
          inputValue={settings.downloadPath}
          inputPlaceholder="JMFMobile/downloads"
          inputReadOnly
          loading={picking}
          onClick={() => void pickDirectory()}
          onInputChange={(v) => void update({downloadPath: v})}
        />
      </ListGroup>
      <ListGroup title={t('settings.network')}>
        <ListTile
          variant="plain"
          icon="network-check"
          title={t('settings.proxy')}
          subtitle={t('settings.proxyHint')}
          toggleValue={settings.proxyEnabled}
          onToggleChange={(v) => void update({proxyEnabled: v})}
        />
        <div className={styles.domainList}>
          {settings.domains.map((domain, index) => (
            <div className={styles.domainRow} key={index}>
              <Input
                className={styles.domainField}
                value={domain}
                disabled={index < DEFAULT_DOMAIN_COUNT}
                onChange={(value) => {
                  const next = [...useSettingsStore.getState().settings.domains];
                  next[index] = value;
                  void update({domains: next});
                }}
              />
              <span className={styles.domainTrailing}>
                {index >= DEFAULT_DOMAIN_COUNT ? (
                  <IconButton
                    label={t('settings.removeDomain')}
                    variant="soft"
                    size="md"
                    onClick={() => update({domains: settings.domains.filter((_, i) => i !== index)})}
                  >
                    <Icon name="close" size={18} />
                  </IconButton>
                ) : (
                  <Badge tone="neutral">{t('settings.default')}</Badge>
                )}
              </span>
            </div>
          ))}
          <div className={styles.domainRow}>
            <Input
              className={styles.domainField}
              value={newDomain}
              placeholder={t('settings.addDomain')}
              onChange={setNewDomain}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDomain();
              }}
            />
            <IconButton
              label={t('settings.addDomainLabel')}
              variant="accent"
              size="lg"
              onClick={addDomain}
            >
              <Icon name="add" size={20} />
            </IconButton>
          </div>
        </div>
      </ListGroup>
    </>
  );
}

import {t} from '@/web/i18n';
import {Chip} from '@/web/ui/Chip';
import {ReadMoreText} from '@/web/ui/ReadMoreText';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';
import styles from './detail.module.css';

export interface MetaBlock {
  title: string;
  tags: string[];
}

export function DetailTags({
  blocks,
  onTagPress,
}: {
  blocks: MetaBlock[];
  onTagPress: (tag: string) => void;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className={styles.blocks}>
      {blocks.map((block) => (
        <div key={block.title} className={styles.section}>
          <span className={styles.blockTitle}>{block.title}</span>
          <div className={styles.tags}>
            {block.tags.map((tag) => (
              <Chip
                key={tag}
                size="sm"
                className={hasJapanese(tag) ? styles.titleJa : undefined}
                onClick={() => onTagPress(tag)}
              >
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailDesc({description}: {description: string}) {
  if (!description) return null;
  return (
    <div className={styles.section}>
      <span className={styles.blockTitle}>{t('detail.desc')}</span>
      <ReadMoreText text={description} lines={3} />
    </div>
  );
}

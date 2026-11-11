/**
 * Renders manifest `notes` as readable blocks instead of raw Markdown markers.
 */
import {t} from '@/web/i18n';
import {parseNotes} from './notes';
import styles from './updatePrompt.module.css';

export interface ReleaseNotesProps {
  notes: string | null | undefined;
}

export function ReleaseNotes({notes}: ReleaseNotesProps) {
  const blocks = parseNotes(notes);
  if (blocks.length === 0) return null;

  return (
    <div className={styles.notes}>
      <span className={styles.notesTitle}>{t('update.notesTitle')}</span>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <span className={styles.noteHeading} key={index}>
              {block.text}
            </span>
          );
        }
        if (block.kind === 'bullet') {
          return (
            <span className={styles.noteBullet} key={index}>
              {block.text}
            </span>
          );
        }
        return (
          <span className={styles.noteText} key={index}>
            {block.text}
          </span>
        );
      })}
    </div>
  );
}

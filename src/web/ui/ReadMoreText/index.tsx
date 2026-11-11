import {t} from '@/web/i18n';
import {useEffect, useRef, useState} from 'react';
import styles from './readMoreText.module.css';

export interface ReadMoreTextProps {
  text: string;
  /** Number of lines shown while collapsed. */
  lines?: number;
  moreLabel?: string;
  lessLabel?: string;
}

export function ReadMoreText({
  text,
  lines = 3,
  moreLabel = t('common.expand'),
  lessLabel = t('common.collapse'),
}: ReadMoreTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setOverflowing(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, lines, expanded]);

  return (
    <div className={styles.wrap}>
      <p
        ref={ref}
        className={[styles.text, expanded ? styles.expanded : ''].filter(Boolean).join(' ')}
        style={expanded ? undefined : {WebkitLineClamp: lines}}
      >
        {text}
      </p>
      {overflowing || expanded ? (
        <button type="button" className={styles.toggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}

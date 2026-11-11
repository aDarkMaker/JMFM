import {useEffect, useRef, useState} from 'react';
import styles from './poster.module.css';
import {useCoverSrc} from '@/web/hooks/useCoverSrc';
import {hasJapanese} from '@/web/hooks/useJapaneseFont';

export interface PosterProps {
  coverPath?: string;
  /** Local album directory used to resolve relative cover paths. */
  albumDir?: string;
  title: string;
  /** Stable per-album tint when the cover is missing or still loading. */
  tintIndex?: number;
  /** Short label rendered inside the fallback block. */
  fallbackChars?: number;
  /** Omit to let the parent size the poster (e.g. absolute fill). */
  ratio?: '3/4' | '1/1' | '16/9' | 'fill';
  className?: string;
  /** Dark gradient anchored to the bottom for overlaid text. */
  scrim?: boolean;
  /** Top-right / top-left affordances rendered above the artwork. */
  children?: React.ReactNode;
}

const TINTS = 6;

/** Shared cover base: tint fallback, fade-in artwork, optional scrim. */
export function Poster({
  coverPath,
  albumDir,
  title,
  tintIndex,
  fallbackChars = 4,
  ratio = '3/4',
  className,
  scrim,
  children,
}: PosterProps) {
  const [src, retryCover] = useCoverSrc(coverPath, albumDir);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const retried = useRef(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setNonce(0);
    retried.current = false;
  }, [coverPath, title, src]);

  const tint = `var(--cover-tint-${(((tintIndex ?? 0) % TINTS) + TINTS) % TINTS + 1})`;
  const showImg = src !== null && !failed;
  const fill = ratio === 'fill';

  return (
    <div
      className={[styles.root, fill ? styles.fill : '', className ?? ''].filter(Boolean).join(' ')}
      style={fill ? {background: tint} : {background: tint, aspectRatio: ratio}}
      data-ratio={ratio}
    >
      {showImg ? (
        <img
          // Bumping the key remounts the element so a failed URL is refetched.
          key={`${src}#${nonce}`}
          className={[styles.image, loaded ? styles.imageLoaded : ''].filter(Boolean).join(' ')}
          src={src ?? undefined}
          alt=""
          decoding="async"
          ref={(el) => {
            // Preload can finish before mount; cached imgs skip onLoad and stay at opacity 0.
            if (!el || loaded || failed) return;
            if (el.complete && el.naturalWidth > 0) {
              queueMicrotask(() => setLoaded(true));
            }
          }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!retried.current) {
              retried.current = true;
              retryCover();
              setNonce((n) => n + 1);
              return;
            }
            setFailed(true);
          }}
        />
      ) : (
        <span className={[styles.fallback, hasJapanese(title) ? styles.fallbackJa : ''].filter(Boolean).join(' ')}>
          {title.slice(0, fallbackChars)}
        </span>
      )}
      {scrim ? <span className={styles.scrim} aria-hidden /> : null}
      {children}
    </div>
  );
}

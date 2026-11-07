import {useEffect, useState} from 'react';
import {useCoverSrc} from '../hooks/useCoverSrc';
import {invalidateCoverSrc} from '../library/coverCache';
import {hasJapanese} from '../hooks/useJapaneseFont';

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
  const src = useCoverSrc(coverPath, albumDir);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [coverPath, title, src]);

  const tint = `var(--cover-tint-${(((tintIndex ?? 0) % TINTS) + TINTS) % TINTS + 1})`;
  const showImg = src !== null && !failed;
  const fill = ratio === 'fill';

  return (
    <div
      className={`poster${fill ? ' is-fill' : ''}${className ? ` ${className}` : ''}`}
      style={fill ? {background: tint} : {background: tint, aspectRatio: ratio}}
      data-ratio={ratio}
    >
      {showImg ? (
        <img
          className={`poster-img${loaded ? ' is-loaded' : ''}`}
          src={src ?? undefined}
          alt=""
          decoding="async"
          ref={(el) => {
            // Preload can finish before mount; cached imgs skip onLoad and stay opacity:0.
            if (!el || loaded || failed) return;
            if (el.complete && el.naturalWidth > 0) {
              queueMicrotask(() => setLoaded(true));
            } else if (el.complete) {
              queueMicrotask(() => setFailed(true));
            }
          }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (coverPath) invalidateCoverSrc(coverPath);
            setFailed(true);
          }}
        />
      ) : (
        <span className={`poster-fallback${hasJapanese(title) ? ' is-ja' : ''}`}>
          {title.slice(0, fallbackChars)}
        </span>
      )}
      {scrim ? <span className="poster-scrim" aria-hidden /> : null}
      {children}
    </div>
  );
}

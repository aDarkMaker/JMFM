import {useCallback, useEffect, useState} from 'react';
import {invalidateCoverSrc, peekCoverSrc, resolveCoverSrc} from '@/web/library/coverCache';

const MAX_RETRY = 1;

/**
 * Resolves a local or remote cover path into an <img>-usable src. `retry`
 * drops the cached URI and re-resolves once, so a cover that failed while the
 * SAF grant was stale can recover without remounting the card.
 */
export function useCoverSrc(
  coverPath?: string,
  albumDir?: string
): [src: string | null, retry: () => void] {
  const [src, setSrc] = useState<string | null>(() => (coverPath ? peekCoverSrc(coverPath) : null));
  const [retried, setRetried] = useState<{path?: string; count: number}>({path: coverPath, count: 0});
  const attempt = retried.path === coverPath ? retried.count : 0;

  useEffect(() => {
    let alive = true;
    if (!coverPath) {
      setSrc(null);
      return;
    }

    const cached = peekCoverSrc(coverPath);
    if (cached) {
      setSrc(cached);
      return;
    }

    setSrc(null);
    void resolveCoverSrc(coverPath, albumDir).then((next) => {
      if (alive) {
        setSrc(next);
      }
    });

    return () => {
      alive = false;
    };
  }, [coverPath, albumDir, attempt]);

  const retry = useCallback(() => {
    if (!coverPath || attempt >= MAX_RETRY) return;
    invalidateCoverSrc(coverPath);
    setRetried({path: coverPath, count: attempt + 1});
  }, [coverPath, attempt]);

  return [src, retry];
}

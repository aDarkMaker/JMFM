import {useEffect, useState} from 'react';
import {peekCoverSrc, resolveCoverSrc} from '../library/coverCache';

export function useCoverSrc(coverPath?: string): string | null {
  const [src, setSrc] = useState<string | null>(() =>
    coverPath ? peekCoverSrc(coverPath) : null,
  );

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
    void resolveCoverSrc(coverPath).then(next => {
      if (alive) {
        setSrc(next);
      }
    });

    return () => {
      alive = false;
    };
  }, [coverPath]);

  return src;
}

import {useEffect, useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';

export function useCoverSrc(coverPath?: string): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (!coverPath) {
      return;
    }
    if (/^(https?:|blob:|data:)/.test(coverPath)) {
      setSrc(coverPath);
      return;
    }
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    Filesystem.getUri({path: coverPath, directory: Directory.Documents})
      .then(r => {
        if (alive) {
          setSrc(Capacitor.convertFileSrc(r.uri));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [coverPath]);
  return src;
}

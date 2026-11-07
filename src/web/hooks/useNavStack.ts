import {useCallback, useEffect} from 'react';
import {useNavStore} from '../stores/nav';

/** Matches `.nav-layer.is-closing` exit duration. */
export const NAV_CLOSE_MS = 240;

/**
 * Navigation stack for overlay screens (discover / search / detail).
 * Used by App to render the topmost entry and by screens to push/back.
 */
export function useNavStack() {
  const stack = useNavStore((s) => s.stack);
  const closing = useNavStore((s) => s.closing);
  const push = useNavStore((s) => s.push);
  const back = useNavStore((s) => s.back);
  const finishClose = useNavStore((s) => s.finishClose);
  const reset = useNavStore((s) => s.reset);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(finishClose, NAV_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing, finishClose]);

  const pushDiscover = useCallback(
    (params?: {category?: string; order?: string}) => push({type: 'discover', params}),
    [push]
  );
  const pushSearch = useCallback(
    (params?: {query?: string; category?: string}) => push({type: 'search', params}),
    [push]
  );
  const pushDetail = useCallback(
    (albumId: number, title?: string) => push({type: 'detail', params: {albumId, title}}),
    [push]
  );

  return {stack, closing, back, reset, pushDiscover, pushSearch, pushDetail};
}

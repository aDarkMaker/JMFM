import {useCallback, useEffect, useRef, useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App as CapacitorApp} from '@capacitor/app';
import {ReaderTarget} from '../reader/types';

const CLOSE_MS = 220;

export function useReaderLifecycle() {
  const [reader, setReader] = useState<ReaderTarget | null>(null);
  const [readerClosing, setReaderClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerRef = useRef<ReaderTarget | null>(null);
  const closingRef = useRef(false);
  readerRef.current = reader;
  closingRef.current = readerClosing;

  const openReader = useCallback((target: ReaderTarget) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    closingRef.current = false;
    setReaderClosing(false);
    setReader(target);
  }, []);

  const closeReader = useCallback(() => {
    if (!readerRef.current || closingRef.current) return;
    closingRef.current = true;
    setReaderClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      closingRef.current = false;
      setReaderClosing(false);
      setReader(null);
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const h = CapacitorApp.addListener('backButton', () => {
      if (readerRef.current && !closingRef.current) {
        closeReader();
      } else if (!readerRef.current) {
        void CapacitorApp.minimizeApp();
      }
    });
    return () => void h.then((x) => x.remove());
  }, [closeReader]);

  return {reader, readerClosing, openReader, closeReader};
}

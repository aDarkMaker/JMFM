import {useEffect} from 'react';
import {Capacitor} from '@capacitor/core';
import {Keyboard} from '@capacitor/keyboard';

export function useKeyboardVisibility(): void {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const show = Keyboard.addListener('keyboardDidShow', () => {
        document.body.classList.add('keyboard-open');
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        document.body.classList.remove('keyboard-open');
      });
      const isTextInput = (el: EventTarget | null) => {
        const node = el as HTMLElement | null;
        return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA');
      };
      const onFocusIn = (e: FocusEvent) => {
        if (isTextInput(e.target)) {
          document.body.classList.add('keyboard-open');
        }
      };
      const onFocusOut = (e: FocusEvent) => {
        if (isTextInput(e.target)) {
          document.body.classList.remove('keyboard-open');
        }
      };
      document.addEventListener('focusin', onFocusIn);
      document.addEventListener('focusout', onFocusOut);
      return () => {
        void show.then(h => h.remove());
        void hide.then(h => h.remove());
        document.removeEventListener('focusin', onFocusIn);
        document.removeEventListener('focusout', onFocusOut);
      };
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardOpen = vv.height < window.innerHeight * 0.8;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);
}

import {createRoot} from 'react-dom/client';
import {App} from '@/web/App';
import {AppErrorBoundary} from '@/web/features/errors/AppErrorBoundary';
import '@/web/theme/index.css';
import '@/web/styles/fonts.css';
import '@/web/styles/shell.css';
import '@/web/reader/engine.css';

if (import.meta.hot) {
  void import('@/web/dev/error-overlay').then((mod) => mod.installErrorOverlay());
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('root element not found');
}
createRoot(rootEl).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

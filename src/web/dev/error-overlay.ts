/** Dev-only overlay: surfaces runtime errors that would otherwise only be in logcat. */
const PANEL_ID = 'dev-error-overlay';

function ensurePanel(): HTMLDivElement {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing as HTMLDivElement;
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:8px',
    'left:8px',
    'max-height:40vh',
    'overflow:auto',
    'z-index:2147483647',
    'padding:12px',
    'border-radius:12px',
    'background:rgba(20,10,12,0.96)',
    'color:#ffd9d9',
    'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
    'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
    'white-space:pre-wrap',
    'word-break:break-word',
    '-webkit-user-select:text',
    'user-select:text',
  ].join(';');
  panel.addEventListener('click', () => panel.remove());
  document.body.appendChild(panel);
  return panel;
}

function report(title: string, detail: string): void {
  const panel = ensurePanel();
  const entry = document.createElement('div');
  entry.textContent = `[${title}] ${detail}`;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;
}

export function installErrorOverlay(): void {
  window.addEventListener('error', (event) => {
    const error = event.error as Error | undefined;
    report('error', error?.stack ?? event.message ?? String(error));
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    report('promise', reason instanceof Error ? (reason.stack ?? reason.message) : String(reason));
  });
}

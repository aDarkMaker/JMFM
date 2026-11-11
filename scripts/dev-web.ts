/** Browser/dev-server entry: HTML routes with CSS Modules (HMR off). */
import {networkInterfaces} from 'node:os';
import index from '../src/web/index.html';

const PORT = Number(process.env.DEV_PORT || 3000);

function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  return null;
}

const lan = lanAddress();
const addr = lan ? `http://${lan}:${PORT}/` : `http://localhost:${PORT}/`;

console.log('[dev:web] Bun HTML server');
console.log(`[dev:web] desktop  ${addr}`);
console.log('[dev:web] device   bun run dev:android   (same WiFi)');
console.log('[dev:web] usb      bun run dev:android:usb');
console.log('[dev:web] browser console is streamed here');
console.log('[dev:web] HMR off — Bun CSS Modules bug (oven-sh/bun#18258); refresh to pick up edits\n');

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  // HMR drops CSS-module namespace objects: ReferenceError import_*_module is not defined.
  development: {hmr: false, console: true},
  routes: {
    '/': index,
    '/*': index,
  },
});

const stop = () => {
  server.stop(true);
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

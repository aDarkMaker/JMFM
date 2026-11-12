/** Web build entry: HTML + CSS Modules, React production output, and a browser stand-in for Node's `crypto`. */
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {readVersion} from './read-version';

const ROOT = join(import.meta.dir, '..');
const OUTDIR = join(ROOT, 'dist');
const MINIFY = process.argv.includes('--minify');

rmSync(OUTDIR, {recursive: true, force: true});

const result = await Bun.build({
  entrypoints: [join(ROOT, 'src/web/index.html')],
  outdir: OUTDIR,
  target: 'browser',
  minify: MINIFY,
  splitting: true,
  define: {
    __APP_VERSION__: JSON.stringify(readVersion().version),
    'process.env.NODE_ENV': JSON.stringify(MINIFY ? 'production' : 'development'),
  },
  plugins: [
    {
      // crypto-js probes `require('crypto')` and bundling pulls Bun's Node
      // polyfill (660KB) into a browser bundle. Answer with the Web Crypto
      // object the runtime already has.
      name: 'browser-crypto',
      setup(build) {
        build.onResolve({filter: /^(node:)?crypto$/}, () => ({
          path: 'browser-crypto',
          namespace: 'browser-crypto',
        }));
        build.onLoad({filter: /.*/, namespace: 'browser-crypto'}, () => ({
          contents: 'module.exports = globalThis.crypto;',
          loader: 'js',
        }));
      },
    },
  ],
});

for (const log of result.logs) {
  console.warn(String(log));
}

if (!result.success) {
  process.exit(1);
}

console.log(`[build] web ${MINIFY ? 'release' : 'dev'} → dist`);

# Verification & Testing

## Unit tests

`bun test` covers the core modules:

| Module | Coverage |
|---|---|
| `transcode` | getNum strip calculation, computeStrips reverse reorder |
| `crypto` | MD5, AES-256-ECB key derivation and decryption |
| `parser` | Base64 decode, HTML parsing |
| `model` | image URL construction, ImageItem creation |
| `net` | domain rotation, URL construction |
| `download-service` | end-to-end orchestration (mocked network and runtime) |
| `pdf` | uniform width, proportional scaling, title sanitizing |
| `constants` / `settings` | config and settings persistence |

Run:

```bash
bun run test
```

## Node-side real verification

`scripts/verify-download.ts` runs the full pipeline in Node (no emulator):

```bash
bun run verify 1327951
```

It will:

1. Refresh dynamic domains.
2. Fetch album and chapters via `ApiClient`.
3. Download all images concurrently.
4. Reassemble strips with ImageMagick.
5. Generate a uniform-width PDF under `temp/<albumId>/`.

Verified against album 1327951: 50 pages, all at 960pt width, no white placeholders, no tiny pages.

## Checking the PDF

Inspect the page structure with pdf-lib:

```bash
node -e "
const {PDFDocument} = require('pdf-lib');
const fs = require('fs');
(async () => {
  const doc = await PDFDocument.load(fs.readFileSync('temp/1327951/<title>.pdf'));
  const pages = doc.getPages();
  const sizes = new Set(pages.map(p => {
    const s = p.getSize();
    return s.width.toFixed(0) + 'x' + s.height.toFixed(0);
  }));
  console.log('pages:', pages.length, 'distinct sizes:', [...sizes]);
})();
"
```

Expected: `pages: 50`, `distinct sizes: ['960x...', ...]` (all widths 960).

## Static checks

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run build       # bun build output
```

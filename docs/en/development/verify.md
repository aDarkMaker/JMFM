# Verification & Testing

## Unit Tests

Jest covers the core modules:

| Module | Coverage |
|---|---|
| `transcode` | getNum strip count, computeStrips reversed layout |
| `crypto` | MD5, AES-256-ECB key derivation and decryption |
| `parser` | Base64 decode, HTML parsing |
| `model` | image URL construction, ImageItem creation |
| `net` | domain rotation, URL construction |
| `download-service` | end-to-end orchestration (mocked network and runtime) |
| `pdf` | uniform width, proportional scaling, title cleaning |
| `constants` / `settings` | config and settings persistence |

Run:

```bash
bun run test
```

## Node-side Real Verification

`scripts/verify-download.ts` runs the whole pipeline in Node (no emulator):

```bash
bun scripts/verify-download.ts 1327951
```

It:

1. Refreshes dynamic domains.
2. Fetches album and chapter via `ApiClient`.
3. Downloads all images concurrently.
4. Reassembles strips with ImageMagick.
5. Generates a uniform-width PDF under `temp/<albumId>/`.

Verified with album 1327951: 50 pages, all 960pt wide, no white placeholders, no tiny pages.

## Inspecting the PDF

Check the generated PDF's page structure:

```bash
python3 -c "
import re
data = open('temp/1327951/<title>.pdf','rb').read()
boxes = re.findall(rb'/MediaBox\s*\[([^\]]+)\]', data)
ws = [int(x.split()[2]) for x in boxes]
print('pages:', len(boxes), 'distinct widths:', len(set(ws)))
"
```

Expected: `pages: 50`, `distinct widths: 1`.

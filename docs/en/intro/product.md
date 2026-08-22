# Product

JMFM is a download tool built for comic lovers. It is powered by React Native and TypeScript, and makes "carrying your favorite comics in your pocket" delightfully simple: enter an album ID, and let the pipeline do the rest.

## Why JMFM

Collecting comics should never be a chore. In practice, getting a complete, clean original image often means fighting through obstacles:

- Pages are sliced into scrambled strips; saving them directly gives you unreadable fragments.
- Web endpoints get blocked frequently; today's address may be gone tomorrow.
- Pages come in mixed widths, producing ragged PDFs that are painful to read.

JMFM absorbs all of that friction behind the scenes. You pick the title, and a reliable pipeline handles the rest.

## How It Works

A smooth, automated pipeline:

1. **Stable Fetching** — the mobile API channel auto-refreshes domains and bypasses web blocks.
2. **Image Restoration** — a strip algorithm detects the slicing pattern and reassembles pages in order.
3. **Elegant Output** — pages are aligned to a uniform width and exported as a clean, titled PDF.

## Tech Stack

| Area | Choice | Why |
| --- | --- | --- |
| Framework | React Native 0.87 | One codebase, both platforms |
| Language | TypeScript | Type safety, long-term maintainability |
| Networking | axios | Domains rotation, retries, proxy out of the box |
| Crypto | crypto-js | Lightweight MD5 and AES-256-ECB |
| Image decode (RN) | @shopify/react-native-skia | Pixel-level restoration |
| PDF (RN) | react-native-images-to-pdf | Native-grade PDF generation |
| Image decode (Node) | ImageMagick | High-fidelity rendering for verification |
| Testing | Jest | Full coverage of core algorithms |

## Status

The business pipeline is fully working and verified against a real album (ID 1327951, 50 pages). The UI layer is under design — stay tuned.

# Product

JMFM is a download tool built for comic lovers. It is powered by Capacitor + React Web and TypeScript, and makes "carrying your favorite comics in your pocket" delightfully simple: enter an album ID, and let the pipeline do the rest.

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
| Framework | Capacitor 8 + React Web | Web UI inside a native shell, one codebase for both platforms |
| Language | TypeScript | Type safety, long-term maintainability |
| Build | Bun | Fast bundling, no Metro dependency |
| Networking | axios + CapacitorHttp | Domains rotation, retries, proxy out of the box; native stack on device |
| Crypto | crypto-js | Lightweight MD5 and AES-256-ECB |
| Image decode (device/Web) | Web Canvas | Pixel-level restoration |
| PDF generation | pdf-lib | Pure-JS uniform-width PDF |
| Image decode (Node) | ImageMagick | High-fidelity rendering for verification |
| Storage | Capacitor Filesystem / Preferences | Native filesystem and preference storage |
| Testing | bun test | Full coverage of core algorithms |

## Status

The business pipeline is fully working and verified against a real album (ID 1327951, 50 pages). The Android native project is ready, and the frontend runs inside the Capacitor shell — stay tuned.

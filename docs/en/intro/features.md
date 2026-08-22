# Features

## Stable Fetching, Any Network

- **API-first channel**: frees you from web endpoints and, fundamentally, from domain blocks.
- **Dynamic domain refresh**: decrypts the latest domain list on startup, so stale addresses never stop you.
- **Multi-domain rotation**: fails over to the next domain instantly; timeouts and retries are fully configurable.

## Original Images, Restored

- **Strip calculation**: computes the exact number of slices from album traits and image index.
- **Strip reordering**: crops from source positions and reassembles in reverse order into a complete page.
- **Format adaptation**: webp goes through reassembly, gif is kept as-is, jpg handled on demand.

## Clean Books, Unified Reading

- **Uniform width**: every page scaled proportionally to a single width — shrink only, never upscale.
- **Zero padding**: the page is the image; no white placeholders, just clean full-bleed pages.
- **Title-based naming**: PDFs are named after the comic title with illegal characters cleaned.

## Fully Configurable

All key parameters live in `src/config/app-config.json` — no code changes required:

- Domain lists (HTML / API / CDN / domain servers)
- App secrets and version
- Request headers, timeouts and retries
- Download concurrency limits
- PDF page size and max width

## Built to Last

- **Frontend/backend split**: business core stays independent of UI, testable and reusable.
- **Dual runtime**: RN and Node share one interface, so verification matches device behavior.
- **Full test coverage**: core algorithms are guarded by unit tests.

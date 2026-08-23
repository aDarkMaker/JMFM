---
layout: home

hero:
  name: JMFM
  text: JMComic Comic Downloader
  tagline: Enter an album ID, and get a high-quality PDF in one shot. Built with Capacitor + React Web + TypeScript.
  actions:
    - theme: brand
      text: Quick Start
      link: /en/intro/quickstart
    - theme: alt
      text: Architecture
      link: /en/architecture/overview

features:
  - icon:
    title: API Channel
    details: Dynamic domain refresh + token auth + AES decryption, stable album and chapter fetching beyond DNS blocks.
  - icon:
    title: Image Reassembly
    details: Strip-split algorithm getNum with per-strip crop and reorder to restore full original pages.
  - icon:
    title: Polished PDF
    details: Every page scaled to a uniform width with no padding, named after the comic title.
  - icon:
    title: Config-Driven
    details: Domains, secrets, headers and PDF params all live in one JSON file, no code changes needed.
  - icon:
    title: Frontend/Backend Split
    details: Business core in src/core stays UI-free, independently testable, with a React Web UI in a Capacitor shell.
  - icon:
    title: Multiple Runtimes
    details: Run the whole pipeline in Node or on device; Capacitor / Web / Node runtimes share one interface.
---

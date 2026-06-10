---
title: Release notes ("What's New") page
date: 2026-06-10
slug: release-notes
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Release notes ("What's New") page

> A curated in-app **What's New** overlay opened from a footer link, listing the
> features shipped (newest first).

## Design
- A **"Release Notes"** link in the footer opens a modal overlay (`📋 What's New`)
  with dated entries + bullet items; closeable by ×, backdrop, or Esc.
- Content is a curated static list in `data/releases.js` (trusted), rendered with
  minimal `**bold**` support; escaped otherwise.

## Implementation
- `data/releases.js` (new): `RELEASES` — entries `{ date, title, items[] }`.
- `ui/releases.js` (new): `initReleases` (wire footer link + close) + render.
- `index.html`: footer link + `#releases-backdrop` overlay. `main.js`: init.
- `styles.css`: overlay + entry styling.
- No state/persistence; no `CACHE_PREFIX` bump.

## Results & verification
- `node --check` clean.
- Headless Brave (part of an 8/8 run): footer link present → opens the overlay →
  ≥5 dated entries render (newest "Play with friends" … oldest "Booster boxes")
  → closes cleanly → no runtime errors. Screenshot: `docs/specs/release-notes.png`.

## Changelog
- `<pending>` — Release notes overlay

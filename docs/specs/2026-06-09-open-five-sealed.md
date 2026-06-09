---
title: Open 5 sealed packs at once
date: 2026-06-09
slug: open-five-sealed
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Open 5 sealed packs at once

> Add an "Open 5" button to held sealed packs (Binder ▸ Sealed) that opens up to
> five at once using the existing pack-by-pack-with-skip rip flow.

## Design
- In a sealed-pack tile, when you hold **≥2** of a set, show an **"Open N"**
  button (N = `min(5, held)`) beside "Open one".
- Clicking it consumes `N` sealed packs, banks all their cards at once
  (`addPacks`, one commit), and runs the **same rip session** as "Rip a box"
  (reveal pack-by-pack, "Skip to Results" → summary grid).
- Reuses the box rip machinery — `startBoxSession` is generalised to take a
  display **label** (`"<Set> ×N"` for sealed, `"<Set> Box"` for boxes).

## Implementation
- `ui/pack.js`: new `openManyFromSealed(setId, n)` (consume `min(n, held)` sealed →
  `generatePack` ×count → `addPacks` → `startBoxSession(set, packs, "<Set> ×N")`);
  `startBoxSession(set, packs, label)` + headers now use `boxSession.label`.
- `ui/binder.js`: "Open N" button in the sealed tile (held ≥2) + click → wired to
  `openManyFromSealed(setId, 5)`.
- `styles.css`: green `.open-many` button.
- No state/economy change; no `CACHE_PREFIX` bump.

## Results & verification
- `node --check` + import-graph clean.
- Headless Brave: seed 5 sealed packs of a set → Sealed tile shows "Open 5";
  click → rip session opens 5 packs pack-by-pack (header "<Set> ×5 · Pack k / 5"),
  skip→results; binder grows by the pulled cards; sealed count drops to 0; with 3
  held the button reads "Open 3".

## Changelog
- `206217d` — Open 5 sealed packs at once; pushed to main; deployed ✓

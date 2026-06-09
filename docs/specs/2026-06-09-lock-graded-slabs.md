---
title: Lock graded (PSA) slabs
date: 2026-06-09
slug: lock-graded-slabs
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Lock graded (PSA) slabs

> Let the player lock a graded slab so it can't be accidentally sold — the same
> protection regular cards have, applied to slabs in Binder ▸ Graded.

## Design
- Each slab in the Graded tab gets a **lock toggle** (🔓 Lock / 🔒 Locked) and a
  lock badge when locked.
- A **locked slab can't be sold**: its Sell click is blocked with a toast, and
  `listSlabForSale` refuses a locked slab as a safety net.
- Lock state lives on the slab (`slab.locked`), so it persists with `state.graded`.

## Implementation
- `state/store.js`: `toggleSlabLock(slabId)` flips `slab.locked` on the matching
  graded slab; `listSlabForSale` returns null if the slab is locked.
- `ui/binder.js`: render a lock badge + lock button on each slab; the grid click
  handler toggles lock and blocks selling a locked slab (toast).
- `styles.css`: reuse the existing `.lock-badge`; style the lock button.
- No new state keys, no `CACHE_PREFIX` bump.

## Results & verification
- `node --check` + import-graph clean.
- Bun harness: `toggleSlabLock` flips `locked`; `listSlabForSale` refuses a locked
  slab (stays in `graded`, no sale queued) and works once unlocked.
- Headless Brave: grade a card → slab; Lock it (badge appears); Sell is blocked
  (slab stays, toast); Unlock → Sell lists it; lock persists across reload.

## Changelog
- `39ad199` — Lock graded slabs; deployed ✓

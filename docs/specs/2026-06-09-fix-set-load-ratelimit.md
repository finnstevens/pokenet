---
title: Fix — sealed/pack opening broken by cold-start rate-limiting
date: 2026-06-09
slug: fix-set-load-ratelimit
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
type: bugfix
---

# Fix — sealed/pack opening broken by cold-start rate-limiting

## Symptom (user report)
In the Binder ▸ Sealed tab, clicking "Open one" / "Open pack from box" / "Rip a
box" did nothing — packs/boxes wouldn't open.

## Root cause
Not a button bug. On boot the app **pre-warmed all ~18 sets in parallel**
(`SETS.forEach(loadSet)`). The keyless public pokemontcg.io API **rate-limits the
burst**, so some sets failed with `Failed to fetch`. `loadSet` had **no retry**, so
those sets stayed unloaded. Opening a sealed pack/box calls `loadedSet(apiSetId)`;
when it's null the reveal can't run (and the on-demand reload hit the same rate
limit). The click *did* fire (it navigated to Buy) — it just had no card data.
Confirmed on the live site: open click → switched to Buy tab, no reveal, no JS error.

## Fix
1. **`services/cards.js`** — `fetchSetJson(url)` wraps the fetch with **retry +
   exponential backoff** (4 attempts: ~0.5s/1.1s/2.3s, retrying network errors and
   429/5xx). `loadSet` uses it, keeping its existing memo/in-flight-dedupe/stale-
   cache fallback. Transient rate-limits now recover.
2. **`ui/pack.js`** — `prewarmSets()` loads sets with a **concurrency cap of 4**
   (each finished load starts the next) instead of firing ~18 at once, so the API
   isn't burst-rate-limited in the first place.

Together: the burst is avoided, and any straggler retries through.

## Results & verification
- `node --check` clean.
- **Headless Brave, cold cache (fresh profile)**: **all 17 sets load** on cold
  start (was: several dropped); the brand-new `chaosrising` set loads too.
- **Open flow**: "Open one" from sealed → cards reveal; "Open 1 pack from box" →
  cards reveal (the reported bug, fixed). (Reveal takes ~2.3s for the rip
  animation; that's expected, not a hang.)

## Changelog
- `8bb3614` — loadSet retry/backoff (the core fix)
- pre-warm concurrency cap ships with the Open-5 commit (same deploy)

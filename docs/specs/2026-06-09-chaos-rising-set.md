---
title: Add the Chaos Rising set
date: 2026-06-09
slug: chaos-rising-set
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Add the Chaos Rising set

> Add the brand-new **Chaos Rising** (`me4`, Mega Evolution series, 2026-05-22) —
> real cards + images via pokemontcg.io. $5 pack, $120 / 36-pack box.

## Decisions / defaults
- Set `me4` (Chaos Rising, ME04), 122 cards, all with images.
- **Brand-new → 0 cards priced yet** on pokemontcg.io (same as Ascended Heroes).
  Card values fall back to `RARITY_FALLBACK` floors and **self-heal** once the API
  populates prices. Flagged caveat, not a bug.
- **$5 pack** (matches the sibling Mega set Ascended Heroes), **$120 / 36-pack
  booster box** (real product confirmed: TCGplayer ME04 Booster Box 684444; price
  is a hand-set approximation). Both tweakable.
- Rarities (Common, Uncommon, Rare, Double Rare, Illustration Rare, Ultra Rare,
  Special Illustration Rare, Mega Hyper Rare) **all map via existing
  `rarityToTier`** → rare/holo/ultra/secret. **No engine change.**

## Implementation
- `data/sets.js`: appended `chaosrising` entry (`me4`, $5, `box {36,$120}`,
  modern slots, rareSlot rare 48 / holo 30 / ultra 16 / secret 6, chaos theme).
- Wrapper art: TCGplayer product **684446** (Mega Greninja pack) → trim +
  `sips -Z 640` → `assets/packs/chaosrising.png`.
- No `CACHE_PREFIX` bump (no normalization change).

## Results & verification
- `node --check` clean.
- **Bun harness (6/6)**: `loadSet('me4')` → 122 normalized cards with images +
  tiers (rare/holo/ultra/secret all present); `generatePack` ×200 → valid 8-card
  packs, rare slot ⊆ the set's tiers.
- **API**: `GET /cards?q=set.id:me4` returns HTTP 200 reliably.
- **Headless Brave (4/5)**: in picker at $5, $120/36 Buy Box shows, wrapper art
  renders. The card-list "cards loaded" check flaked once: on a **cold cache** the
  app pre-warms all ~18 sets in parallel with no API key, so the public API
  rate-limits the burst and the last set can lose the race (`Failed to fetch`).
  It recovers — `selectSet` re-calls `loadSet`, and once a set loads it's cached
  (24h). Pre-existing behaviour, now slightly more likely with more sets.
- **Known follow-up**: stagger/limit the boot pre-warm concurrency (or lazy-load
  on select) to avoid the cold-start rate-limit race. Out of scope here; logged.

## Changelog
- `<pending>` — Add the Chaos Rising set (me4)

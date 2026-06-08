---
title: Add the Generations set
date: 2026-06-08
slug: generations-set
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Add the Generations set

> Add the 2016 XY-era **Generations** set (`g1`) — real cards/prices/images.

## Decisions / defaults
- Set `g1` (Generations, 2016/02/22, 117 cards incl. Radiant Collection subset),
  API-confirmed prices + images (115/117 priced).
- **$18 pack** (anniversary set; sealed packs only came via 20th-anniversary
  collections, no booster box) → **no box**. Both default values, tweakable.
- Rarities: Common, Uncommon, Rare, Rare Holo, **Rare Holo EX**, Rare Ultra →
  tiers rare/holo/ultra. **No secret tier** → rareSlot is rare/holo/ultra only.
  `Rare Holo EX` already maps to ultra via `\bex\b` — **no `rarityToTier` change**.

## Implementation
- `data/sets.js`: appended `generations` entry (`g1`, $18, no box, modern slots,
  rareSlot rare 52 / holo 30 / ultra 18, anniversary red/yellow theme).
- Wrapper art: TCGplayer product **187238** (Pikachu pack) → trim + `sips -Z 640`
  → `assets/packs/generations.png`.

## Results & verification
- `node --check` clean.
- Bun harness: `loadSet('g1')` → 117 real priced cards; an EX card → ultra; rare
  slot tiers ⊆ {rare,holo,ultra}; 150 packs valid, all from g1.
- Headless Brave: in picker at $18, loads, **no Buy Box** (no box), wrapper art renders.

## Changelog
- `<pending>` — Add the Generations set (g1)

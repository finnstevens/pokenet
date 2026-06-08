---
title: Add the Black & White set
date: 2026-06-08
slug: black-and-white-set
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Add the Black & White set

> Add the 2011 **Black & White** base set (`bw1`) as a new openable set — real
> cards, real prices, a single-pack cost, and its own 36-pack booster box.

## Motivation / problem
The catalog has modern SV/SWSH sets and vintage WotC sets but nothing from the
Black & White era. The user asked to add it.

## Goals
- New set `Black & White` (`apiSetId: bw1`) in the picker, opening real cards.
- Single pack costs **$22**; a **$520 / 36-pack booster box** (now that boxes exist).
- Real wrapper art in `assets/packs/<id>.png` (fallback to logo+gradient if not).

## Non-goals
- No engine changes — this is a data addition via the documented "Adding a set"
  recipe. No new rarity strings (all of bw1's map to existing tiers).

## Decisions (Gate 1)
- Set: **bw1** (Black & White base, 2011/04/25, 115 cards). Confirmed via API to
  have prices + images.
- `id: 'blackwhite'`, pack **$22**, box **$520 × 36**, modern-style pack (has
  reverse holos).

## Requirements & behavior
- Add one `SETS` entry in `src/data/sets.js` with `cost/sealedPrice: 22`,
  `box: { packs: 36, price: 520 }`, modern slots incl. `reverse`, and a
  `rareSlot` weighted over the tiers bw1 actually has (rare/holo/ultra/secret).
- Pack art at `assets/packs/blackwhite.png` (real wrapper, trimmed + downscaled).
- Everything else (loading, pricing, boxes, sealed) works by convention.

## Data & state
- **bw1 rarities (API)**: Common 44, Uncommon 37, Rare 19, Rare Holo 12,
  Rare Ultra 2, Rare Secret 1. `rarityToTier` already maps: Rare Holo→holo,
  Rare→rare, Rare Ultra→ultra, Rare Secret→secret. **No map change needed.**
- `rareSlot` weights: rare 52 / holo 30 / ultra 13 / secret 5.
- No `CACHE_PREFIX` bump (no normalization change). New cache key
  `pokepack.set.v3.bw1` populates on first load.

## Acceptance criteria
- [ ] Black & White appears in the picker with a $22 label and loads real cards.
- [ ] Its rare slot yields rare/holo/ultra/secret from real bw1 cards (no random
      fallback), reverse slot re-prices to reverseHolofoil.
- [ ] A $520 / 36-pack Buy Box button shows and banks a box.
- [ ] Wrapper art renders (or clean logo+gradient fallback).
- [ ] `node --check` clean; loadSet(bw1) + generatePack verified in a harness;
      visible in headless Brave.

## Research & findings
- API confirmed: `bw1`, 115 cards, real TCGplayer prices + images. All rarity
  strings map to existing tiers (checked against `rarityToTier`).
- bw1 packs (2011) included reverse holos → modern slot layout with `reverse`.
- Wrapper art: source a real BW booster-pack image (TCGplayer product CDN or
  retailer og:image), trim white with PIL, `sips -Z 640`, save as
  `assets/packs/blackwhite.png`. If a clean image can't be sourced, ship without
  it (logo+gradient fallback) and note as a follow-up.

## Implementation plan
1. Source + process wrapper art → `assets/packs/blackwhite.png`.
2. Add the `SETS` entry in `src/data/sets.js` (append).
3. Verify: parse, Bun harness (loadSet bw1 → 115 cards, tiers present;
   generatePack pulls valid cards + box flows), headless Brave screenshot.

## Test strategy
- `node --check` on sets.js.
- Bun harness: `loadSet('bw1')` returns 115 normalized cards with prices; tier
  distribution includes ultra+secret; `generatePack` over the set yields 8 cards
  with the rare slot in {rare,holo,ultra,secret}.
- Headless Brave: pick Black & White, confirm it loads + Buy Box at $520; screenshot.

## Results & verification
**Built**: one `SETS` entry appended in `src/data/sets.js` (`id: blackwhite`,
`apiSetId: bw1`, $22 pack, `box: {packs:36, price:520}`, modern slots + rare slot
rare/holo/ultra/secret, black/white/blue theme). Real wrapper art sourced from
the TCGplayer product CDN (product **98553**, the Reshiram pack), trimmed (no
border) + `sips -Z 640` → `assets/packs/blackwhite.png` (336×640, matches others).
No engine/`rarityToTier`/`CACHE_PREFIX` changes.

**Verification — all green:**
- `node --check` on sets.js → clean.
- **Bun harness (7/7)**: `loadSet('bw1')` → 115 normalized cards; tiers include
  holo/ultra/secret; >50% have real TCGplayer prices; every card has image + a
  `bw1-` uid; 200 generated packs all = 8 cards from bw1 with the rare slot in
  {rare,holo,ultra,secret} (never a random fallback).
- **Headless Brave (6/6)**: Black & White in the picker labelled $22; cards load;
  selecting it shows the $520 / 36-pack Buy Box; pack ready to open; the real
  wrapper art (`#pack-art`) loads (not the logo+gradient fallback).
- Screenshot: `docs/specs/black-and-white-picker.png`.

All acceptance criteria met.

## Changelog
- `d051494` — Add the Black & White set (bw1) (pushed to main; auto-deploys)

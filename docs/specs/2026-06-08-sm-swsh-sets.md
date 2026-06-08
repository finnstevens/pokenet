---
title: Add Hidden Fates, Champion's Path, Unified Minds
date: 2026-06-08
slug: sm-swsh-sets
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Add Hidden Fates, Champion's Path, Unified Minds

> Add three SM/SWSH-era sets. Unlike Black & White, these introduce GX/V/VMAX/
> Rainbow rarities, so `rarityToTier` must be extended (+ a `CACHE_PREFIX` bump).

## Goals
- Three new openable sets with real cards/prices/images + wrapper art:
  - **Hidden Fates** `sm115` — $35 pack, no box.
  - **Champion's Path** `swsh35` — $28 pack, no box.
  - **Unified Minds** `sm11` — $10 pack, **$300 / 36-pack box**.
- Extend `rarityToTier` to handle GX/VMAX/Rainbow so hits tier correctly.

## Non-goals
- **Hidden Fates Shiny Vault** (`sma`) — separate sub-set; not merged now
  (one-id-per-set). Hidden Fates ships with its 69 base cards only. Future spec.
- No boxes for Hidden Fates / Champion's Path (never had standard booster boxes).

## Decisions (Gate 1)
- Prices: $35 / $28 / $10. Box: Unified Minds only, $300 × 36.
- Hidden Fates = base `sm115` only (Shiny Vault deferred).

## Requirements & behavior
1. Extend `rarityToTier` (`services/cards.js`): add `vmax`/`vstar`→ultra and
   `\bgx\b`→ultra, placed **before** the bare `holo` fallback. (`rainbow`→secret,
   `ultra`, `secret` already handled; `Rare Holo V` stays holo via `holo`.)
2. Bump `CACHE_PREFIX` `.v3.`→`.v4.` (tiering changed) so cached sets recompute.
3. Add three `SETS` entries (modern slots incl. `reverse`; `rareSlot` weighted
   over only the tiers each set actually has).
4. Wrapper art `assets/packs/{hiddenfates,championspath,unifiedminds}.png`.

## Data & state — real rarities (API-verified)
- **sm115** (69, 100% priced): Common, Uncommon, Rare, Rare Holo, Rare Holo GX,
  Rare Ultra, Rare Rainbow → tiers rare/holo/ultra/secret. No Rare Secret string.
- **swsh35** (80, 100% priced): + Rare Holo V, Rare Holo VMAX, Rare Secret.
- **sm11** (260; API returns first 250, 248 priced): GX/Ultra/Rainbow present.
  Note: pageSize=250 means ~10 highest-numbered cards aren't loaded (existing
  architectural limit) — acceptable; flagged.
- `rareSlot` weights (only tiers the set has):
  - sm115: rare 50 / holo 30 / ultra 15 (GX) / secret 5 (Rainbow).
  - swsh35: rare 46 / holo 32 (V) / ultra 16 (VMAX+Ultra) / secret 6 (Rainbow+Secret).
  - sm11: rare 50 / holo 30 / ultra 15 (GX+Ultra) / secret 5 (Rainbow).

## Acceptance criteria
- [ ] All three sets in the picker with correct $ labels; load real cards.
- [ ] GX/VMAX/Rainbow cards tier to ultra/ultra/secret (not holo) — verified.
- [ ] Unified Minds shows a $300 / 36-pack Buy Box; the other two show none.
- [ ] Rare slot for each set never falls back to a random card.
- [ ] Wrapper art renders (or clean fallback); `CACHE_PREFIX` bumped to `.v4.`.
- [ ] `node --check` clean; Bun harness + headless Brave green.

## Research & findings
- API confirms ids, ~100% price coverage, images for all three.
- `rarityToTier` today has no GX/VMAX/Rainbow keywords → those would mis-map to
  holo (GX/VMAX) or fall through (Rainbow). None of the existing 12 sets use these
  strings, so the additions are purely additive to current output — but the
  documented rule is to bump `CACHE_PREFIX` on any tiering change, so bump to `.v4.`.
- Wrapper art via TCGplayer product CDN (booster-pack product ids) or retailer
  og:image; trim + `sips -Z 640`.

## Implementation plan
1. `services/cards.js`: extend `rarityToTier` (gx/vmax→ultra, rainbow→secret);
   bump `CACHE_PREFIX` to `pokepack.set.v4.`.
2. Source + process 3 wrapper arts → `assets/packs/`.
3. `data/sets.js`: append the 3 `SETS` entries.
4. Update CLAUDE.md persistence note (`.v3.`→`.v4.`).
5. Verify (below).

## Test strategy
- `node --check` on changed JS.
- Bun harness: for each set `loadSet` returns real priced cards; assert a known
  GX card → ultra, a VMAX → ultra, a Rainbow → secret; `generatePack` ×200 yields
  valid 8-card packs with rare slot ⊆ the set's tiers.
- Headless Brave: three sets in picker w/ correct prices; Unified Minds Buy Box
  $300, others none; wrapper art loads; screenshot.

## Results & verification
**Built** — deviations from plan noted:
- `services/cards.js`: added `vmax`/`vstar`→ultra and `\bgx\b`→ultra before the
  `holo` fallback. **`rainbow`→secret already existed** (so not re-added — plan
  corrected). Bumped `CACHE_PREFIX` `.v3.`→`.v4.`.
- `data/sets.js`: appended Hidden Fates ($35), Champion's Path ($28), Unified
  Minds ($10, $300×36 box). **Champion's Path rare-slot is holo/ultra/secret only**
  — the set has no plain-`Rare` tier (lowest hit is Rare Holo), so including
  `rare` would have caused random fallbacks. Caught via the API rarity data.
- Wrapper art: TCGplayer product CDN — Hidden Fates 198634, Champion's Path
  218789, Unified Minds 191883 — trimmed + `sips -Z 640` → `assets/packs/`.
- CLAUDE.md persistence note updated to `.v4.`.

**Verification — all green:**
- `node --check` on sets.js + cards.js → clean.
- **Bun harness (34/34)**: `rarityToTier` units (GX/VMAX→ultra, V→holo,
  Rainbow→secret, existing holo/ex intact); for each set: real cards load + mostly
  priced; a **real** GX/VMAX/Rainbow card tiers to ultra/ultra/secret; every
  declared rare-slot tier exists in the set; 150 generated packs each = 8 cards
  from the set with rare-slot ⊆ declared tiers (no random fallback).
- **Headless Brave (12/12)**: all three in the picker at $35/$28/$10; all load;
  Unified Minds shows a $300/36-pack Buy Box; Hidden Fates & Champion's Path show
  none; all three wrapper arts render.
- Screenshot: `docs/specs/sm-swsh-sets-picker.png`.

All acceptance criteria met.

## Changelog
- `<pending>` — Add Hidden Fates, Champion's Path, Unified Minds (+ GX/VMAX tiering)

---
title: Representative card prices (stop averaging variants)
date: 2026-06-10
slug: representative-card-prices
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Representative card prices (stop averaging variants)

> Price each card at its **representative single printing** instead of the average
> of all variants — so multi-printing cards (esp. vintage 1st-Edition + Unlimited)
> show their real value, while single-variant chase cards stay exact.

## Problem (from the price check)
`normalizeCard` set `price = average(all variant market prices)`. For cards with
multiple printings this blends prices that should be separate — e.g. **Fossil
Articuno** = 1st-Ed Holo $206 + Unlimited Holo $55 → app showed **$130**, but the
game's vintage packs are **Unlimited** (~$55). Single-variant cards were already
exact.

## Fix
Replace the average with a **priority pick** of one variant's `market` price:
`holofoil → normal → unlimitedHolofoil → unlimited → reverseHolofoil` then the
1st-Edition variants as last resort; if none match, the cheapest **non-1st-Edition**
variant (else the cheapest). Rationale: prefer the card's main finish, treat the
game as **Unlimited** (skip 1st-Edition premiums), and never average distinct
printings. The `prices` variant map is unchanged, so `packs.js` reverse-holo
re-pricing still works.

## Examples (after)
- Fossil Articuno → **$55.33** (unlimitedHolofoil), was $130.82.
- 151 Charmander → **$0.18** (normal), was $0.26 (reverse pulls still $0.34 via packs.js).
- Charizard ex SIR / Moonbreon / Base Charizard → unchanged (single variant, exact).

## Implementation
- `services/cards.js`: replace `averagePrice` with `representativePrice` +
  `PRICE_VARIANT_PRIORITY`; `normalizeCard` uses it. **Bump `CACHE_PREFIX`
  `v4 → v5`** so cached sets recompute.
- `CLAUDE.md`: update the pricing note + cache-version references.

## Acceptance criteria
- [ ] Multi-variant cards price to the representative printing (Articuno → $55.33),
      not the average; 1st-Edition is skipped when an Unlimited/other variant exists.
- [ ] Single-variant cards are unchanged/exact.
- [ ] `prices` map still present (reverse-holo re-pricing intact).
- [ ] `CACHE_PREFIX` is `v5`; `node --check` clean; harness verifies the mapping.

## Test strategy
- Bun harness over `normalizeCard` with crafted variant maps (Articuno 1stEd+Unl,
  Charmander normal+reverse, single-variant holo, normal+holofoil, reverse-only,
  unpriced→rarity floor).
- Load real sets (Fossil, 151, Base) and confirm representative prices are sane
  (Articuno ≈ $55, chase cards unchanged).

## Results & verification
**Built**: `cards.js` — `representativePrice` + `PRICE_VARIANT_PRIORITY` replace
`averagePrice`; `normalizeCard` uses it; `CACHE_PREFIX` bumped `v4 → v5`. CLAUDE.md
pricing + cache notes updated.

**Verification — all green:**
- `node --check` clean.
- **Bun harness (9/9)**: 1stEd+Unlimited → Unlimited ($55.33, skips 1stEd);
  normal+reverse → normal ($0.18); single holofoil exact ($489.28); holo+reverse
  → holofoil (no blend); reverse-only → reverse; 1stEd-only → last-resort; unpriced
  → rarity floor; `prices` map preserved (reverse re-pricing intact). Real
  `loadSet('base3')` → Articuno **$55.33** (was $130.82).
- **Headless Brave (4/4)**: in-browser Articuno $55.33; `v5` cache key written;
  no runtime errors on boot.

All acceptance criteria met. Chase/single-variant cards unchanged; multi-printing
(esp. vintage 1st-Ed+Unlimited) cards now show their true Unlimited value.

## Changelog
- `<pending>` — Representative-variant card pricing (v5)

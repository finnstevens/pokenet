---
title: Card Show sellers + hit-weighted collections
date: 2026-06-11
slug: card-show-sellers
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Card Show sellers + hit-weighted collections

> The Card Show's singles are now organised into **sellers** — you **explore a
> seller's collection** (a grid of their cards) to find cards to buy/trade. And
> the collections skew **~80% hits**, so far fewer commons/uncommons are sold.

## Decisions (Gate 1)
- **Browse seller binders**: a few named sellers; click one to explore their
  collection grid; buy/trade from it. Replaces the flat singles list.
- **Lower non-hits in what's sold**: seller collections are hit-weighted (~80%
  rare/holo/ultra/secret), so commons/uncommons sold drop dramatically. (Pack pull
  rates are unchanged.)
- **Mostly hits** intensity (~80% hits).

## Design
- `generateStock` now produces, in addition to packs + a box:
  - **`sellers`**: `[{ id, name }]` — 3 sellers from a fun name pool.
  - **singles** (in the flat `items` array, each tagged `sellerId`): ~8 per seller,
    drawn by a **hit-weighted tier distribution** (common 10 / uncommon 10 / rare
    25 / holo 25 / ultra 20 / secret 10 → ~80% hits), unique across the show, priced
    at market with a few **deals** (priciest discounted). Sets missing a tier fall
    back to the next available (hits first).
- `items` stays a **flat array** (singles + packs + box) so `buyShowItem` /
  `tradeForShowItem` (find-by-id) are **unchanged**. Only the UI groups by seller.

## UI (events.js)
- The singles area shows a **seller list** ("🧑 Name · N/M cards"). Click a seller →
  **explore** their collection grid (Buy / Trade) with a "← Sellers" back button.
- Packs + Box sections unchanged below. `exploringSeller` is UI-only state, reset
  on entering a new show. Old-format stock (no `sellers`) falls back to a flat
  Singles section (graceful).

## Acceptance criteria
- [ ] Entering a show shows ~3 seller tiles; clicking one reveals that seller's
      card grid; back returns to the seller list.
- [ ] Seller collections are ~80% hits (commons/uncommons rare) — far fewer than
      before.
- [ ] Buying / trading a card from a seller still works (sells out; flat-items
      logic unchanged); packs + box unaffected.
- [ ] `node --check` clean; harness + headless verify sellers + hit-rate.

## Test strategy
- Bun harness: `generateStock` produces `sellers` (3) + sellerId-tagged singles
  (~8 each, unique); over a large sample the hit fraction is ≈ 0.8 (≫ a flat
  random draw); packs/box still present; deals applied.
- Headless: enter show → seller tiles render → explore one → its grid shows →
  buy a card (sells out) → back to sellers. Screenshot.

## Results & verification
**Built**: `game/cardshow.js` — `generateStock` now emits `sellers` (3 from a name
pool) + sellerId-tagged singles (8 each) drawn by a hit-weighted tier distribution
(~80% hits); flat `items` kept so store buy/trade is unchanged. `ui/events.js` —
seller list + explore-one-collection view + back; `exploringSeller` UI state reset
on entry; old-format fallback. `styles.css` — seller tiles/explore header.

**Verification — all green:**
- `node --check` clean.
- **Bun harness (8/8)**: 3 sellers; every single sellerId-tagged; 8 per seller;
  unique across the show; packs(3)+box present; 3 deals; **hit fraction ≈ 0.81**
  over 60 shows (vs ~0.30 for a flat random draw) — dramatically fewer non-hits.
- **Headless Brave (8/8)**: enter → 3 seller tiles (singles hidden) → explore one →
  its hit-heavy grid renders → buy a card (sells out) → "← Sellers" returns to the
  list. Screenshot: `docs/specs/card-show-sellers.png`.

All acceptance criteria met.

## Changelog
- `76a1cd8` — Card Show sellers + hit-weighted collections; deployed ✓

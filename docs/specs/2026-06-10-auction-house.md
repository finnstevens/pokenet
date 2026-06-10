---
title: Auction House (Events tab)
date: 2026-06-10
slug: auction-house
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Auction House (Events tab)

> A **sell-only** Auction House: **consign your cards** with a **reserve price**,
> and AI bidders bid them up live over a countdown. Meet your reserve → sold for
> the final bid (which can beat market); fall short → it comes back unsold. Second
> event in the Events tab. (Buying lives in the Card Show; the auction is for
> selling.)

## Decisions (Gate 1, revised)
- **Sell-only**: you auction off your own cards. (The "bid to buy house lots" side
  was removed — buying is the Card Show's job.)
- **Live ascending** AI bidding with a countdown.
- **Reserve price**: you set an asking price when consigning; it only sells if the
  bids reach it.
- **Location**: an "Auction House" section in the **Events** tab (below the Card Show).

## How it works
- **Consign a card**: pick one of your unlocked/un-sleeved cards **and set a reserve
  (asking) price** (the input prefills to its market value). The card leaves your
  binder into a sell lot (escrow).
- AI bidders **bid it up over ~35s** toward a hidden value ≈ market × `0.6–1.4`
  (shown as a live, climbing current bid + countdown).
- At timer end:
  - top bid **≥ your reserve** → **SOLD**: you receive the final bid as cash (can be
    above market — the upside);
  - top bid **< your reserve** → **UNSOLD**: the card **returns to your binder**.
- Set a high reserve to protect value (risk no sale); set it low to sell for sure.
- Auctions resolve even when you're on another tab (global ticker + a toast on
  settle).

## Data & state
- `state.auctions: []` (persisted) — sell lots:
  `{ id, card, market, reserve, currentBid, aiMax (hidden), endsAt, aiNextAt }`.
- No `CACHE_PREFIX` bump (save state only). Old saves default `[]`.

## Architecture
- `game/auction.js` (new): constants (`AUCTION_DURATION_MS`, AI value range),
  `bidIncrement(bid)`, `makeSellLot(card, reserve, now)`, `aiStep(lot, now)`
  (climb `currentBid` toward `aiMax` on a cadence), `isEnded(lot, now)`. Pure-ish.
- `state/store.js`: `auctions` + persist; `consignCard(uid, reserve, now)` (escrow a
  binder card → sell lot; excl. locked/sleeved); `processAuctions(now)` (climb due
  lots via `aiStep`; settle ended lots → pay if reserve met, else return the card;
  returns outcomes for toasts).
- `ui/events.js`: an Auction House section — a **Consign a card** button (→ a
  picker + reserve-price modal) and your active lots (live current bid, reserve,
  countdown, SOLD/UNSOLD on settle). A **global ticker** runs `processAuctions`
  always so lots resolve off-tab (with toasts), re-rendering only on the Events tab.
- `index.html`: auction section in `#view-events` + a consign modal.
- `styles.css`: lot cards, consign modal.

## Acceptance criteria
- [ ] Events tab shows an Auction House with a "Consign a card" button.
- [ ] Consigning picks a card + reserve, removes the card (escrow), and creates a
      live lot whose bid climbs over the countdown.
- [ ] At timer end: reserve met → cash paid (final bid); reserve missed → card
      returns to the binder. A toast reports the outcome.
- [ ] Locked/sleeved cards can't be consigned.
- [ ] Lots resolve even when on another tab; state persists across reload.
- [ ] `node --check` clean; Bun harness + headless Brave green.

## Risks / simplifications (v1)
- AI is a hidden-ceiling climb model (no personalities). Tunable value range.
- One card per consign; no cancel (the reserve protects you instead).

## Test strategy
- Bun harness: `bidIncrement`; `makeSellLot` shape (reserve, aiMax, endsAt);
  `aiStep` climbs `currentBid` toward but never past `aiMax`; `consignCard`
  escrows the card + excludes locked/sleeved; `processAuctions` settles a met-
  reserve lot (pays final bid, removes it) and a missed-reserve lot (returns the
  card), and only acts when due/ended.
- Headless Brave: enter Events → Consign a card (pick + reserve) → lot appears,
  card gone from binder; let the bid climb; force-settle (seed endsAt past) → SOLD
  pays cash (or UNSOLD returns the card); persists across reload. Screenshot.

## Results & verification
**Built (sell-only, per the revised scope)**: `game/auction.js` (`bidIncrement`,
`makeSellLot` with reserve + hidden aiMax, `aiStep` climb, `isEnded`);
`store.js` (`auctions` state + persist; `consignCard` escrow + guards;
`processAuctions` — climb due lots, settle: reserve met → pay final bid, missed →
return card); `events.js` (Auction House section, live lots, consign picker +
reserve modal, global ticker resolving lots off-tab with toasts); `index.html` +
`styles.css`. No `CACHE_PREFIX` bump.

**Verification — all green:**
- `node --check` + import-graph clean.
- **Bun harness (19/19)**: `bidIncrement`; `makeSellLot` shape (reserve, aiMax ∈
  market×[0.6,1.4], opens below reserve, endsAt); `aiStep` climbs toward but never
  past aiMax and only when due; `consignCard` escrows + rejects missing/locked/
  sleeved/zero-reserve; `processAuctions` pays a met-reserve lot, returns a missed
  one, removes settled lots.
- **Headless Brave (13/13)**: Consign button + empty state; modal lists
  consignable cards; pick prefills reserve to market; List escrows the card +
  shows a live lot; force-settle SOLD pays cash (lot gone, card not returned);
  force-settle UNSOLD returns the card; persists across reload.
- Screenshot: `docs/specs/auction-house.png`.

All acceptance criteria met.

## Changelog
- `<pending>` — Add the Auction House (sell-only, reserve price)

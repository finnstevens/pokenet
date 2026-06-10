---
title: Trading at the Card Show
date: 2026-06-10
slug: card-show-trading
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Trading at the Card Show

> Barter at the Card Show: offer cards from your binder as **trade-in credit**
> toward any show item, topping up the difference with cash. Trade-ins are valued
> at the **dealer haircut (~70% of market)** — so cash-buying vs trading is a real
> choice.

## Decisions (Gate 1)
- **Trade cards toward an item**: each show item gets a **Trade** action; you pick
  binder cards to offer + pay any cash shortfall.
- **Trade-in value = dealer haircut** = `sellValue` (0.7× market) — same as selling.

## Behavior
- Every show item (single / pack / box) gets a **Trade** button beside **Buy**.
- Trade opens a panel: the target item + its price, your **offerable** cards
  (owned, **not locked, not sleeved**), and running totals:
  - **Trade credit** = Σ `sellValue(card)` of selected cards.
  - **Cash needed** = `max(0, item.price − credit)`.
- **Complete Trade** is enabled when you can cover the cash shortfall. On complete:
  the offered cards leave your binder, the cash shortfall is charged, you receive
  the item (single→binder, pack→sealed, box→boxes), and it sells out.
- One copy per selected card (v1). If credit exceeds the price, **no change is
  given** (a warning shows) — pick fewer cards to avoid overpaying.

## Data & state
- No new persisted state. New store actions:
  - `grantShowItem(item, now)` (extracted) — routes a granted item to
    binder/sealed/boxes + marks sold (shared by Buy and Trade).
  - `tradeForShowItem(itemId, offeredUids, now)` — validates ownership +
    not-locked/not-sleeved, computes credit (`sellValue`) and cash shortfall,
    removes offered copies, charges the shortfall, grants the item. Returns
    `{ ok, item, cashPaid, credit }` / `{ error }` / null.
- `buyShowItem` refactored to use `grantShowItem`.

## UI
- `events.js`: a **Trade** button per item; a **trade modal** (target + offerable
  card grid with per-card trade value, live credit / cash-needed, Complete).
- `index.html`: `#trade-backdrop` / `#trade-modal`.
- `styles.css`: trade modal + selectable offer cards.

## Acceptance criteria
- [ ] Each show item shows a Trade button; opening it lists offerable cards
      (locked/sleeved excluded).
- [ ] Selecting cards updates trade credit (0.7× market each) and cash-needed live.
- [ ] Complete Trade removes the offered copies, charges only the shortfall, and
      grants the item (which sells out). Blocked if you can't cover the shortfall.
- [ ] Overpay (credit > price) gives no change, with a warning.
- [ ] `node --check` clean; Bun harness + headless Brave green.

## Research & findings
- Reuses `sellValue` (0.7× haircut) for trade-in value — matches "dealer haircut".
- `buyShowItem` already routes single/pack/box → extract `grantShowItem` and share
  it with trade. Offerable set mirrors the sell guards (exclude `locked`/`sleeved`).
- Trade modal follows the card-detail modal pattern (own backdrop, click to close).

## Implementation plan
1. `state/store.js`: extract `grantShowItem`; add `tradeForShowItem`.
2. `index.html`: trade modal markup.
3. `ui/events.js`: Trade buttons + trade modal (open/render/select/complete).
4. `styles.css`: trade modal styling.

## Test strategy
- Bun harness: `tradeForShowItem` — credit = Σ sellValue; cash shortfall charged;
  offered copies removed; item granted + sold; blocked when can't cover; refuses
  locked/sleeved offers; pure-trade (credit ≥ price) charges $0.
- Headless Brave: enter show → Trade an item → select cards (credit/cash update) →
  Complete → cards gone, item received + Sold, money down by only the shortfall.

## Results & verification
**Built as planned**: `store.js` extracted `grantShowItem` (shared by Buy/Trade)
and added `tradeForShowItem` (credit = Σ `sellValue`, charge only the shortfall,
remove offered copies, grant + sell out; refuses locked/sleeved/over-offer/empty);
`index.html` trade modal; `events.js` Trade button + modal (target, live
credit/cash, selectable offer grid, overpay warning, Complete); `styles.css`.

**Verification — all green:**
- `node --check` + import-graph clean.
- **Bun harness (13/13)**: `sellValue` 0.7×; trade credit + cash shortfall correct;
  offered copies removed; item granted + sold; pure-trade charges $0; multi-card
  offers; broke → error (nothing changed); locked/sleeved refused; empty + over-
  offer rejected.
- **Headless Brave (14/14)**: Trade button opens the modal listing offerable cards
  (locked/sleeved excluded); selecting 2 cards shows $70 credit + highlights;
  Complete removes only those cards, grants the single, marks it Sold, charges only
  the shortfall, and closes the modal.
- Screenshot: `docs/specs/card-show-trade.png`.

All acceptance criteria met.

## Changelog
- `8b30af6` — Add Card Show trading + Auction House; deployed ✓

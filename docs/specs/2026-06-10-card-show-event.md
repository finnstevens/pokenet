---
title: Card Show event (Events tab)
date: 2026-06-10
slug: card-show-event
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Card Show event (Events tab)

> A recurring **Card Show** you can attend once an hour. Entering generates a
> one-time lineup of **singles (real cards), packs, and boxes** to buy — most at
> market, with a few below-market **deals** — then a 1-hour cooldown to the next
> show. Lives in a new **Events** top tab. (Realizes the deferred "buy specific
> cards" idea.)

## Decisions (Gate 1)
- **Attend once per hour**: an "Enter the Card Show" action gated by a 1h
  cooldown; each entry generates a fresh lineup. The lineup persists so you can
  keep buying from it until the next show.
- **Singles priced at market, with a few deals** (a couple of items below market).
- **Location**: new **Events** top tab (Shop / Binder / Work / Events). The Card
  Show is the first event; the tab leaves room for more.

## Gameplay
- Events tab shows the Card Show: either **"Enter the Card Show"** (when ready) or
  a **"Next show in MM:SS"** countdown, plus the current lineup if you have one.
- A lineup has three groups:
  - **Singles** (~6): random real cards at market price; ~2 flagged **DEAL**
    (40–65% off, original price struck through).
  - **Packs** (~3): random sets' packs at a small **show discount** (~10%).
  - **Box** (~1): a random boxed set at a ~10% discount.
- **Buy** spends money and: singles → your binder (gradeable, with condition
  fields); packs → sealed; boxes → your boxes. Bought items sell out.

## Data & state
- `state.lastCardShow` (ts) — the 1h cooldown (mirrors `lastWork`).
- `state.cardShowStock` = `{ generatedAt, items: [...] }`, persisted so the lineup
  survives navigation/reload. Item: `{ id, kind:'single'|'pack'|'box', price,
  listPrice, deal, ... }` (single carries a `card` snapshot; pack/box carry
  `setId`/`packs`/art).
- Persist `lastCardShow`, `cardShowStock`. Old saves default (null / none).
  **No `CACHE_PREFIX` bump** (save state only).

## Architecture
- `game/cardshow.js` (new, pure/testable): `generateStock(pool, sets, now)` —
  picks singles/packs/box, applies market pricing + deals/discounts, returns the
  lineup; constants (counts, discount ranges).
- `game/economy.js`: `CARD_SHOW_COOLDOWN_MS = 1h`, `cardShowCooldownRemaining`.
- `state/store.js`: `lastCardShow` + `cardShowStock`; `enterCardShow(stock, now)`
  (set stock + stamp cooldown); `buyShowItem(itemId, now)` (charge + route to
  binder/sealed/boxes by kind; mark sold). Singles reuse `freshBinderEntry`
  (gradeable) and DON'T bump `packsOpened`.
- `ui/events.js` (new): `initEvents`/`renderEvents` (enter/countdown + lineup +
  buy wiring + cooldown ticker). Pool from `loadedSet` across `SETS`.
- `index.html`: Events tab + `#view-events`.
- `main.js`: `initEvents` + subscriber + tab-entry refresh.
- `styles.css`: events view, show-item cards, DEAL badge.

## Acceptance criteria
- [ ] Events tab present; Card Show shows Enter (ready) or a live countdown.
- [ ] Entering (when ready) generates a lineup and starts the 1h cooldown; you
      can't re-enter until it elapses, but can keep buying the current lineup.
- [ ] Singles priced at market with ~2 visible deals; packs/box at a show discount.
- [ ] Buying charges money and adds: single→binder (gradeable), pack→sealed,
      box→boxes; the item sells out; can't buy if you can't afford it.
- [ ] State persists across reload; old saves load fine.
- [ ] No new deps; `node --check` clean; Bun harness + headless Brave green.

## Open questions — resolved at Gate 1
1. Counts 6 singles / 3 packs / 1 box, deals 40–65% off, packs/box 10% off.
2. Singles **biased toward rarer/chase** cards (mixed, exciting).

<!-- ───────────────────────── GATE 1 ───────────────────────── -->

## Results & verification
**Built as planned** (the Architecture section is the plan): `game/cardshow.js`
(generateStock — weighted-to-chase singles, 2 priciest become deals, packs/box at
10% off); `game/economy.js` (`CARD_SHOW_COOLDOWN_MS=1h`, remaining); `store.js`
(`lastCardShow` + `cardShowStock` + persist; `enterCardShow`, `buyShowItem` routing
single→binder (gradeable, no packsOpened bump) / pack→sealed / box→boxes);
`ui/events.js` (Events tab: enter/countdown, lineup, buy, ticker); `index.html`
Events tab + view; `main.js` wiring; `styles.css` show items + DEAL badge.

**Verification — all green:**
- `node --check` on 5 files + import-graph → clean.
- **Bun harness (21/21)**: stock has 6 singles / 3 packs / 1 box; exactly 2
  deals priced below list; non-deal singles at market; packs/box ~10% off; box
  has packs; `enterCardShow` stamps cooldown; buy single → binder (gradeable, no
  `packsOpened` bump) and marks sold; can't re-buy a sold item; pack→sealed,
  box→boxes; broke → error not bought; 1h cooldown counts down / clears.
- **Headless Brave (13/13)**: Events tab; Enter (no cooldown) → lineup renders
  with 2 deal badges; Enter disappears + countdown starts; buying charges money,
  lands the item, marks it Sold; lineup + cooldown persist across reload.
- Screenshot: `docs/specs/card-show.png`.

All acceptance criteria met.

## Changelog
- `f23aa9b` — Add the Card Show event (Events tab); deployed ✓

---
title: Card Sleeves
date: 2026-06-08
slug: card-sleeves
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Card Sleeves

> Buy a box of sleeves (65 for $8) → a consumable sleeve inventory. Sleeve a card
> → it shows a "sleeved" badge and is protected from selling. The per-card
> sleeved flag is the foundation a future **grading** feature will build on.

## Motivation / problem
Groundwork for a planned grading system: you protect a card with a sleeve to
preserve its condition. Right now sleeving = a tracked per-card flag + selling
protection; grading will later read that flag.

## Goals
- A buyable **box of sleeves**: $8 → +65 sleeves (consumable inventory count).
- **Sleeve a card** (from its detail modal): consumes one sleeve, marks the card
  sleeved (badge), and protects it from selling / bulk-sell.
- **Un-sleeve**: returns the sleeve to inventory (non-destructive).
- Sleeve count + a place to buy lives in the Shop.

## Non-goals
- **Grading** itself (future). Sleeves only establish the `sleeved` flag + inventory.
- Per-set / branded sleeve designs (one generic product for now).
- Sleeves as a displayed sealed collectible — it's a consumable count, not a tile.
- Condition/value changes (grading will own that).

## Decisions (Gate 1)
- One generic product: **Card Sleeves (65) — $8**.
- Sleeving = mark sleeved **+ protect from selling**; un-sleeve refunds the sleeve.

## Requirements & behavior
1. **State**: `sleeves` (number, available inventory) + `sleeved` (uid[]). Persisted.
2. **Buy**: a "Card Sleeves (65) — $8" button in a new **Supplies** section of
   Shop ▸ Buy; shows "You have N sleeves". Charges $8 → +65 (toast). Too poor →
   toast, no charge.
3. **Apply** (card modal): a Sleeve toggle next to Lock.
   - Not sleeved + `sleeves > 0` → sleeve it (`sleeves--`, add uid to `sleeved`).
   - Not sleeved + `sleeves == 0` → toast "No sleeves — buy a box in the Shop."
   - Sleeved → un-sleeve (`sleeves++`, remove uid).
4. **Protection**: sleeved cards are excluded from `listForSale` and
   `bulkSellCommonsUncommons` (same treatment as `locked`); clicking a sleeved
   card in Sell → toast "Sleeved — remove the sleeve to sell."
5. **Badges**: a sleeve badge on sleeved mini-cards in the binder (and in the
   Sell grid).

## UX / UI
- **Shop ▸ Buy**: a `Supplies` section under the pack stage — product label, $8
  price, Buy button, current sleeve count.
- **Card modal**: `🧷 Sleeve` ⇄ `🧷 Sleeved` toggle (mirrors the Lock button),
  with a small "N sleeves left" hint.
- **Binder/Sell mini-cards**: a `🧷` badge when sleeved (CSS like `.lock-badge`).

## Data & state
- `store.js`: `sleeves: 0`, `sleeved: []` in `freshState()` + `PERSIST_KEYS`.
  Actions: `addSleeves(n)`, `toggleSleeve(uid)` (returns `{sleeved}` or null if
  none to apply), `isSleeved(uid)`. Guard `listForSale`/`bulkSell` on `sleeved`.
- Old saves: defaults (0 / []) cover them. **No `CACHE_PREFIX` bump** (no card
  normalization change).

## Acceptance criteria
- [ ] Buy Sleeves charges $8 and adds 65; count shows + persists.
- [ ] Sleeving a card consumes one sleeve, sets the badge, and blocks selling it
      (single + bulk); un-sleeving refunds the sleeve and re-enables selling.
- [ ] Sleeving with 0 sleeves is blocked with a toast.
- [ ] `sleeved` persists across reload; old saves load fine.
- [ ] No new deps; `node --check` clean; verified in headless Brave.

## Research & findings
- Mirrors the existing **`locked`** mechanic exactly: `state.locked` (uid[]),
  `toggleLock`, `isLocked`, and the sale guards in `listForSale` /
  `bulkSellCommonsUncommons` / shop.js click. Sleeving adds a parallel `sleeved`
  list with the same guards, plus a consumable `sleeves` counter.
- Modal already renders Lock/Wishlist toggles (`modal.js`) → add a Sleeve toggle
  the same way. Mini-card badges already exist (`lock-badge`/`wish-badge`) → add
  a `sleeve-badge`.
- New purchase UI: a Supplies block in `#shop-buy`; render + wire in `shop.js`
  (owns the shop view); count re-renders via the store subscriber on commit.

## Implementation plan
1. `store.js`: state + `addSleeves`/`toggleSleeve`/`isSleeved`; guard sale funcs.
2. `index.html`: Supplies section in `#shop-buy`.
3. `shop.js`: `renderSupplies()` + buy-sleeves wiring; sleeved guard/toast + badge
   in the Sell grid.
4. `modal.js`: Sleeve toggle + sleeves-left hint.
5. `binder.js`: sleeve badge on mini-cards.
6. `styles.css`: `.sleeve-badge`, supplies section, sleeve button states.

## Test strategy
- `node --check` on changed JS + import-graph.
- Bun harness: `addSleeves`, `toggleSleeve` (consume/refund, none-left guard),
  `isSleeved`; `listForSale`/`bulkSell` skip sleeved; persistence round-trip.
- Headless Brave: buy sleeves ($8 debit, +65); open a card, sleeve it (count→64,
  badge, sale blocked + toast); un-sleeve (count→65, sellable); reload persists.
- Screenshot: Supplies section + a sleeved card.

## Results & verification
**Built as planned** across 6 files: `store.js` (`sleeves`/`sleeved` state +
`addSleeves`/`toggleSleeve`/`isSleeved`, `listForSale`/`bulkSell` guards);
`index.html` (Supplies section); `shop.js` (buy button $8→+65, `renderSupplies`,
Sell-grid sleeved guard + `sleeved` tag/badge); `modal.js` (Sleeve toggle +
"N sleeves left" hint + no-sleeves toast); `binder.js` (sleeve badge);
`styles.css` (`.sleeve-badge`, supplies block). No `CACHE_PREFIX` bump.

**Verification — all green:**
- `node --check` on all 4 changed JS files → clean.
- **Bun harness (sleeve portion of 14/14)**: fresh defaults; `addSleeves`→65;
  sleeve consumes one + flags; sleeved card can't be listed; bulk-sell skips it;
  un-sleeve refunds + re-enables selling; sleeving with 0 left is blocked.
- **Headless Brave (16/16)**: Buy Sleeves debits $8 and adds 65 (persisted);
  sleeve via modal (count→64, badge in binder); Sell shows it protected with a
  `sleeved` tag and clicking does not list it; persistence across reload.
- Screenshot: `docs/specs/card-sleeves-supplies.png`.

All acceptance criteria met. (`sleeved` is the per-card flag the future grading
feature will read.)

## Changelog
- `5f23d22` — Add card sleeves (grading foundation); pushed to main; deployed ✓

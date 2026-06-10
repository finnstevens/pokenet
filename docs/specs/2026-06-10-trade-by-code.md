---
title: Trade with friends by share code
date: 2026-06-10
slug: trade-by-code
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Trade with friends by share code

> Trade with friends **fully offline** (no backend, no deps): bundle up cards,
> sealed packs, boxes, and/or money into a copy-paste **offer code**; your friend
> imports it, adds their own return bundle, and **accepts** → a **confirmation
> code** comes back that you import to finish. A new **Trade** top tab.

## Decisions (Gate 1)
- **Trade by share code** (chosen over gift/view/P2P) — cooperative, serverless.
- **All products tradeable**: singles, sealed packs, booster boxes, and money.
- **Location**: a new **Trade** top tab (Shop / Binder / Work / Events / Trade).

## The model (offline two-code handshake)
There's no server, so a swap can't be atomic — it's a cooperative flow between
friends, with **escrow** to prevent double-spending your own side:

1. **You — Create Offer**: pick items to give (cards / packs / boxes / money).
   They're **escrowed** (removed from your state into a pending offer) so they
   can't be double-spent. You get an **offer code** to send.
2. **Friend — Import code**: pastes your offer → sees your bundle → picks their
   **own** items to give back → **Accept**: your bundle is added to their state,
   their return bundle is removed from theirs → they get a **confirmation code**.
3. **You — Import code**: paste their confirmation → you **receive their return
   bundle**; your escrowed offer is finalized (gone). Trade complete.
- **Cancel**: a pending outgoing offer can be cancelled (before you import a
  confirmation) → the escrowed items return to you.
- Cooperative/trust-based (friends): nothing can force the other side; escrow just
  protects against the common double-spend.

## Tradeable bundle
`{ cards: [snapshot], packs: {setId:count}, boxes: [{setId,packs}], money }`.
- **Cards**: unlocked, un-sleeved binder cards (one copy each). Received cards
  enter the binder as fresh (gradeable) entries.
- **Packs**: counts from `state.sealed`. **Boxes**: box instances (with their
  remaining pack count) from `state.boxes`. **Money**: a dollar amount.

## Data & state
- `state.outgoingTrade = { id, give: bundle, createdAt } | null` (persisted) — your
  escrowed pending offer. Regenerating its code on load lets you re-copy it.
- No `CACHE_PREFIX` bump (save state only). Old saves default null.

## Encoding
- `game/trade.js` (pure): `encodeTrade(type, payload)` → `POKETRADE.<O|C>.<base64>`
  (`O`=offer, `C`=confirm; base64 of compact JSON), `decodeTrade(code)` → `{type,
  payload}` or null (validates prefix/JSON). Card snapshots use short keys to keep
  codes shorter. No deps (native `btoa`/`atob` + `encodeURIComponent`).

## Store actions
- `createTradeOffer(bundle, now)` — validate ownership (cards owned + unlocked/
  un-sleeved, packs/boxes available, money ≤ balance); escrow the bundle; set
  `outgoingTrade`. 
- `cancelTradeOffer()` — return the escrow to your state; clear it.
- `acceptIncomingOffer(offer, myReturn, now)` — add `offer.give` to me, remove
  `myReturn` from me (validated); return the confirmation payload `{id, give}`.
- `finalizeTrade(confirm, now)` — verify `confirm.id === outgoingTrade.id`; add
  `confirm.give`; clear `outgoingTrade`. (Add/remove bundle helpers shared.)

## UI (Trade tab)
- **Your pending offer** (if any): the escrowed bundle + its code (copyable) +
  **Cancel**.
- **Create Offer** (if none pending): a builder — pick cards (grid), packs, boxes,
  money → **Create** → shows the code to copy.
- **Import a Code**: paste box → **Import**. If it's an **offer**, open the accept
  flow (show their bundle + build your return → Accept → confirmation code). If
  it's a **confirmation** matching your pending offer, finalize (receive + done).
- `index.html` Trade tab + `#view-trade`; `main.js` wiring; `styles.css`.

## Acceptance criteria
- [ ] Trade tab; Create Offer escrows the selected bundle and yields an offer code.
- [ ] Importing a friend's offer shows their bundle; building a return + Accept
      transfers correctly and yields a confirmation code.
- [ ] Importing a matching confirmation finalizes (you receive their return; escrow
      cleared). Mismatched/garbage codes are rejected with a toast.
- [ ] Cancel returns the escrow. Locked/sleeved cards can't be offered. You can't
      offer items/money you don't have.
- [ ] State persists across reload (pending offer + its code survive).
- [ ] `node --check` clean; Bun harness + headless Brave green.

## Risks / simplifications (v1)
- Cooperative/trust model (no atomic swap; friends coordinate). Escrow mitigates
  double-spend on the offerer's side only.
- One pending **outgoing** offer at a time (keeps escrow simple). Incoming offers
  are stateless (handled at import).
- Codes can get long for big bundles (copy-paste); compact keys keep them smaller.

## Test strategy
- Bun harness: `encodeTrade`/`decodeTrade` round-trip + reject garbage;
  `createTradeOffer` escrows + validates (rejects unowned/locked/sleeved/over-money);
  `cancelTradeOffer` restores; simulate a full A↔B trade across two state objects
  (A offer → B accept → A finalize) and assert both binders/sealed/boxes/money end
  up correct and nothing is duplicated or lost.
- Headless Brave: Create Offer (escrow + code), Import that code in the same page
  (as "friend") to accept with a return, get a confirmation, import it to finalize;
  Cancel path; bad-code rejection; persistence. Screenshot.

## Results & verification
**Built as planned**: `game/trade.js` (`encodeOffer`/`encodeConfirm`/`decodeTrade`,
compact bundle keys, native base64); `store.js` (`outgoingTrade` + persist;
`ownsBundle`/`addBundle`/`removeBundle`; `createTradeOffer`/`cancelTradeOffer`/
`acceptIncomingOffer`/`finalizeTrade`); `ui/trade.js` (Trade tab home/builder/code
screens, bundle builder for cards+packs+boxes+money, import routing); `index.html`
Trade tab + view; `main.js` wiring; `styles.css`. No `CACHE_PREFIX` bump.

**Verification — all green:**
- `node --check` + import-graph clean.
- **Bun harness (15/15)**: code round-trips a full bundle (cards/packs/boxes/money)
  and rejects garbage; a simulated **A↔B trade** (offer → accept → finalize, state
  swapped between roles) ends with both collections correct and **money + cards
  fully conserved** (no dup/loss); guards reject unowned/empty/locked offers,
  cancel restores the escrow, mismatched confirmations are rejected.
- **Headless Brave (8/8)**: A builds an offer (1 card + $5) → escrowed (money 95,
  card gone) → offer code; reseed as B, import it → see the incoming offer → return
  a card → Accept → B gets the card + $5, gives theirs → confirmation code; restore
  A (pending offer persists across reload) → import confirmation → A receives B's
  card, escrow cleared; bad code handled gracefully.
- Screenshot: `docs/specs/trade-by-code.png`.

All acceptance criteria met.

## Changelog
- `7baac5d` (batch) — Add trade-with-friends by share code

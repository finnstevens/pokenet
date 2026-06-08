---
title: Booster Boxes
date: 2026-06-08
slug: booster-boxes
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Booster Boxes

> Buy a sealed booster box (many packs at a real box price), bank it in the
> binder, then crack packs from it over time — open one, rip the whole box, or
> take all the packs out into your sealed-pack collection.

## Motivation / problem
Today the player can only buy single packs (open now, or "Keep Sealed" one at a
time). Real collectors buy **booster boxes** — a sealed box of N packs at a real,
discounted-vs-singles market price. Boxes add a bigger-buy-in collectible, a
bulk-opening experience, and another money sink/gamble. This mirrors and extends
the existing sealed-pack flow.

## Goals
- Player can **buy a booster box** for a set at that set's real sealed-box price.
- A purchased box is **banked sealed** in Binder ▸ Sealed (not opened on buy).
- From a held box the player can: **open one pack**, **rip the whole box**
  (pack-by-pack with skip), or **take all packs out** into their loose sealed-pack
  collection.
- Boxes hold a **real per-set pack count** (36 for every set that has a box).
- A box tracks **how many packs remain**; opening decrements it; an emptied box
  disappears.

## Non-goals / out of scope
- **Selling boxes** (consistent with sealed packs — display value only).
- **Box appreciation over time** (static price; separate future spec).
- **Ripping a box at purchase** — buying always banks it sealed.
- Boxes for sets without a real standard booster box (see Decisions).
- Changing single-pack buy / keep-sealed behavior.

## Decisions (from Gate 1 interview)
- **Per-box model**: each box tracked independently with its own packs-remaining,
  so one box can be partially opened while another stays full.
- **Rip / take-out scope**: act on **one box at a time** (the most-opened box of
  that set is targeted first, so partial boxes get finished before full ones).
- **Set coverage**: only sets with a **real standard booster box** get one. Main-
  series sets do; special "…pt5" sets and the free set do not. Boxed sets:
  **Surging Sparks, Evolving Skies, Obsidian Flames, EX Dragon, Base Set,
  Fossil**. No box: Prismatic (free), 151, Paldean Fates, Crown Zenith, Ascended
  Heroes (all special/preliminary sets that had no standard 36-pack box).
- **No box for the free set** (Prismatic).
- **+ New action (user request)**: "**Take out all packs**" — empties a box into
  `state.sealed` as loose sealed packs (no opening), then the box is removed.

## Requirements & behavior
1. **Box catalog data**: each boxed set defines `box: { packs: 36, price: <usd> }`
   in `sets.js`. Sets without a real box omit `box` (→ no Buy Box button).
2. **Buy a box** (Shop ▸ Buy): a "Buy Box — $X · 36 packs" button for the
   selected set, only when the set has a `box`. On click: if affordable, charge
   `box.price`, add one box (full, `packs` remaining) to holdings, toast "Box
   added to Binder ▸ Sealed", open nothing. Not affordable → toast, no charge.
3. **Hold model**: `state.boxes[setId]` is an array; each element is one box's
   remaining-pack count. Multiple boxes of a set allowed.
4. **Binder ▸ Sealed** shows boxes (grouped per set) alongside sealed packs: art,
   box count, total packs remaining, box value, and three actions:
   - **Open 1 pack** — consume one pack from the most-opened box and run the
     normal single-pack reveal flow.
   - **Rip a box** — open all remaining packs of one box in a **pack-by-pack
     reveal with "skip to results"**, ending in a summary grid; box removed.
   - **Take out packs** — move one box's remaining packs into `state.sealed`
     (loose sealed packs); box removed. Nothing is opened.
5. **Emptied box** (0 packs) is removed from holdings automatically.
6. **Cards pulled** enter the binder exactly like normal pulls (achievements,
   stats, pricing all reuse existing paths).

## UX / UI
- **Buy (Shop ▸ Buy)**: a "Buy Box — $X · 36 packs" button near "Keep Sealed",
  shown only for sets with a `box`; affordability styling like packs.
- **Binder ▸ Sealed**: box tiles in the existing `#sealed-grid`. Each tile: art,
  `x{n} box · {packsLeft} packs left`, `{price} ea`, and the three buttons.
  Loose sealed-pack tiles keep their current "Open one".
- **Rip session** (reuses `.pack-stage` in Shop ▸ Buy): shows pulled cards in
  `#reveal` with a "Pack k / N" header; controls "Open next pack ▶" and "⏭ Skip
  to results". Skip / finishing shows a results grid of everything pulled with
  best-hit celebration. A "Done" button returns to the picker.

## Data & state
- **`sets.js`**: new optional per-set field `box: { packs, price }` on the 6
  boxed sets (all `packs: 36`). Proposed prices (hand-set approximations, like the
  existing sealed-pack prices — tweakable anytime):
  Surging Sparks **$150**, Obsidian Flames **$140**, Evolving Skies **$520**,
  EX Dragon **$2400**, Fossil **$3200**, Base Set **$9500**.
- **`store.js`**: new persisted `boxes: {}` (`{ [setId]: number[] }`). New actions:
  `addBox(setId, packs)`, `consumeBoxPack(setId)` (decrement most-opened box; remove
  at 0), `takeBox(setId)` (remove the most-opened box, return its remaining count),
  `addSealedMany(setId, n)`, and `addPacks(packArrays)` (bulk add for rip, single
  commit, correct `packsOpened`). Add `'boxes'` to `PERSIST_KEYS` + `freshState()`.
- **Persistence/migration**: old saves lack `boxes`; `freshState()` default `{}`
  covers them. **No `CACHE_PREFIX` bump** (no card-normalization change).

## Acceptance criteria
- [ ] Only the 6 boxed sets show a "Buy Box" button, with correct price + count.
- [ ] Buying a box charges the box price, banks it sealed, opens nothing.
- [ ] Binder ▸ Sealed shows held boxes with accurate packs-remaining + value.
- [ ] "Open 1 pack" reveals one pack and decrements the box by one.
- [ ] "Rip a box" opens all remaining packs (pack-by-pack, with skip) and empties
      the box; pulled cards land in the binder; `packsOpened` increases by N.
- [ ] "Take out packs" adds N loose sealed packs and removes the box; nothing opens.
- [ ] Emptied boxes are removed; multiple boxes of one set handled correctly.
- [ ] Box holdings persist across reload; old saves load without error.
- [ ] No new dependencies; `node --check` clean; verified in headless Brave.

## Open questions
_Resolved at Gate 1 — see Decisions. None outstanding._

<!-- ───────────────────────── GATE 1: spec approved above ───────────────────────── -->

## Research & findings
- **Real booster-box facts**: every set that shipped a standard English booster
  box did so at **36 packs/box** (modern SV/SWSH, vintage WotC/e-Card alike), so a
  uniform `packs: 36` is accurate for all boxed sets. The special "…pt5" sets
  (151, Paldean Fates, Crown Zenith, Prismatic) were sold as booster bundles /
  ETBs / premium collections, **not** standard booster boxes → correctly omitted.
  Ascended Heroes is preliminary/fictional → omitted. Box **prices** have no API
  (same as single sealed packs), so they are hand-set approximations, flagged.
- **Sealed-pack flow precedent** (the model to mirror): `store.addSealed/
  consumeSealed` + `state.sealed` (setId→count); `pack.js keepSealed()` buys-and-
  banks, `openFromSealed(setId)` consumes one and calls `doReveal(set, cards)`;
  `binder.js renderSealed()` renders `#sealed-grid` tiles, click `.open-sealed`
  → `openFromSealed`. Boxes slot directly into these same seams.
- **Reveal internals**: `doReveal(set, cards)` already does `generatePack` +
  `addCards` (banks immediately) then animates — so banking-before-presentation is
  the established pattern; the rip session follows it (bank all N via `addPacks`,
  then present). `addCards` does `packsOpened++` per call; a bulk `addPacks`
  keeps the count correct with a single commit/notify (avoids 36 re-renders).
- **DOM seams**: `.pack-stage` holds `#pack`, `#reveal`, `#actions`
  (`btn-new`/`btn-flip-all`). Rip session reuses `#reveal`; needs its own control
  bar → add `#box-controls` to `index.html` (hidden by default) rather than
  repurposing the wired single-pack buttons.

## Gaps & risks
- **Mid-rip interruption**: bank all N packs up front (`addPacks`) so navigating
  away never loses cards; the session is pure presentation. Box is removed via
  `takeBox` at session start so it can't be double-spent.
- **Many notifies**: use `addPacks` (one commit) not a 36× `addCards` loop.
- **Most-opened targeting**: `consumeBoxPack`/`takeBox` pick the min-remaining box
  so partial boxes finish first and behavior is deterministic with multiple boxes.
- **Empty-state copy** in `renderSealed` must mention boxes now.
- **No `CACHE_PREFIX` bump** — boxes don't touch card data. (Double-checked.)
- **Free/cooldown sets**: boxes always cost money; boxed sets are all non-free, so
  no interaction with the cooldown/free path.

## Approach & alternatives
- **Chosen**: extend the existing sealed system rather than build a parallel one.
  Boxes are a thin new state slice + reuse of `generatePack`/`doReveal`. The rip
  session is a lightweight presentation layer over already-banked pulls (no per-
  pack tear animation — too slow for 36 packs; cards just reveal + "next").
- **Alternatives rejected**: (a) pooled packs-per-set — loses distinct boxes,
  contradicts Gate 1; (b) per-pack tear animation ×36 — tedious, slow;
  (c) banking lazily during reveal — risks losing packs on interruption.

## Implementation plan
1. **`src/data/sets.js`** — add `box: { packs: 36, price }` to surging, evolving,
   obsidian, exdragon, base, fossil (prices above).
2. **`src/state/store.js`** — add `boxes: {}` to `freshState()` + `PERSIST_KEYS`;
   add `addBox`, `consumeBoxPack`, `takeBox`, `addSealedMany`, `addPacks`.
3. **`index.html`** — add `#btn-buy-box` button in `.pack-stage` (near
   `#btn-keep-sealed`) and a hidden `#box-controls` bar in the stage.
4. **`src/ui/pack.js`** — wire `#btn-buy-box` (buy→`addBox`); add
   `openPackFromBox(setId)` (consume one → `doReveal`); add `ripBox(setId)` rip
   session (takeBox → `addPacks` all → present pack-by-pack with skip via
   `#box-controls`); show/hide Buy Box button per set in `selectSet`.
5. **`src/ui/binder.js`** — extend `renderSealed()` to render box tiles; wire
   `.open-box-pack` / `.rip-box` / `.unbox` clicks; update empty-state copy.
6. **`styles/styles.css`** — light touch: reuse `.sealed-card`; style the box
   tile's 3-button row and `#box-controls` if needed.

## Test strategy
- **Parse**: `node --check --input-type=module` on every changed JS file; run the
  import-graph resolver script.
- **Logic harness** (Bun `.mjs`): exercise `addBox`/`consumeBoxPack`/`takeBox`/
  `addSealedMany`/`addPacks` against a seeded `state` — verify per-box decrement,
  most-opened targeting, removal at 0, `packsOpened`/`sealed` math, and that a
  `boxes`-less save loads clean.
- **Headless Brave (DevTools)**: seed `localStorage` with money + a box, reload;
  assert Buy Box only on the 6 sets; buy a box (money debited, box in Sealed);
  Open 1 pack (count −1, card in binder); Rip a box (binder grows by 36 packs,
  box gone); Take out packs (sealed +N, box gone); reload → holdings persist.
- **Screenshot**: Buy Box button + Binder ▸ Sealed box tile.
- **Passing** = all acceptance criteria checked, no console errors.

<!-- ─────────────────────── GATE 2: research & plan approved above ─────────────────────── -->

## Results & verification
**Built as planned** across 6 files — no deviations from the approved plan:
- `sets.js`: `box: {packs:36, price}` on surging/evolving/obsidian/exdragon/base/fossil.
- `store.js`: `boxes` state + `PERSIST_KEYS`; `addBox`, `consumeBoxPack`, `takeBox`,
  `addSealedMany`, `addPacks`, `boxPacksRemaining` (most-opened-box targeting).
- `index.html`: `#btn-buy-box`, `.buy-extra-btns` row, `#box-controls`, `#box-rip-head`.
- `pack.js`: `buyBox`, `openPackFromBox`, `ripBox` + session (`startBoxSession`/
  `showBoxPack`/`advanceBoxSession`/`showBoxResults`/`endBoxSession`/`renderBoxCards`);
  Buy Box toggled per set; hidden during single-pack reveal.
- `binder.js`: box tiles in the sealed grid + 3-action wiring (open/rip/unbox).
- `styles.css`: box tile, button row, rip-session header.

**Verification — all green:**
- `node --check` (module mode) on all 4 changed JS files → clean.
- Static import-graph resolver → all named imports resolve.
- **Bun logic harness (12/12)**: box catalog = exactly the 6 boxed sets @ 36 packs;
  special/free sets have no box; per-box decrement; most-opened targeting;
  `takeBox`/unbox math; `addPacks` packsOpened/totalCards/binder; key removal at 0;
  safe no-ops on empty.
- **Headless Brave UI (11/11)**: Buy Box visible+labelled for obsidian, hidden for
  free set; box tile + 3 buttons render; `packsLeft` correct; unbox → 36 loose
  sealed packs persisted + box removed; buy-box debits exactly $140 and banks a
  36-pack box; no runtime errors.
- **Headless Brave rip session (13/13)**: card data loads; rip starts on Buy tab
  with `#box-controls` visible, "Pack 1 / 3" header, cards revealed, box removed at
  start; advances 1→2→3 with "See Results" on the last; results screen + Done;
  session ends; `packsOpened +3`, binder `+24` cards, box fully consumed.
- Screenshot: `docs/specs/booster-boxes-sealed.png` (sealed grid with box tiles).

All acceptance criteria checked. **Not yet committed/pushed** (awaiting the go-ahead).

## Changelog
- `d192ab2` — Add booster boxes (pushed to main; deployed to GitHub Pages ✓)

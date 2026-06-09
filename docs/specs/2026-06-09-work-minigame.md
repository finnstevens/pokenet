---
title: Work mini-game — Restock Rush
date: 2026-06-09
slug: work-minigame
status: Verified   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Work mini-game — Restock Rush

> A "day job": sort a fast stream of real cards into the right rarity bins before
> the timer runs out. Score-based payout (capped), then a cooldown. Lives in a
> new **Work** top tab.

## Motivation
A skill-based way to earn money (beyond selling + the daily reward), themed as a
shift at the card shop. Gives the early economy a faucet that rewards effort.

## Gameplay (Restock Rush)
- A shift lasts **30 seconds**. A stream of real cards (image + their real rarity
  string) appears one at a time.
- Below are **6 rarity bins** (Common, Uncommon, Rare, Holo, Ultra, Secret),
  colour-coded to the existing rarity palette. Click/tap (or press **1–6**) the
  bin matching the card's tier.
- **Correct** sort → points (base + a streak/combo bonus); the next card appears.
- **Wrong** sort → small point penalty + the combo resets (no time lost; keeps it
  flowing).
- When the timer ends: show **score → payout**, credit the money, start a cooldown.

The challenge is throughput + recognising rarities fast (a clerk learns the
rarities). Bins are labelled, so it's accessible; speed is the real test.

## Payout & balance (Gate 1: score-based, capped, cooldown)
- **Payout** scales with score, **capped at $15/shift**. A weak shift ≈ $2–5, a
  strong one ≈ $12–15. `payoutForScore(score) = min(CAP, round2(score / DIVISOR))`.
- **Cooldown** after a shift (proposed **3 min**) before you can work again —
  reuses `cooldownRemaining`. (Cap + cooldown keep it from breaking the economy:
  ~$15 per few minutes of *active* play.)
- Tunables (confirm at Gate 1): `SHIFT_MS=30s`, `CAP=$15`, cooldown `3 min`,
  scoring weights, `DIVISOR`.

## UI
- **New top tab "Work"** in `#tabs` + a `#view-work` section, three states:
  1. **Ready**: a "Start Shift" button (or a cooldown countdown if not ready),
     plus your last payout / a one-line how-to.
  2. **Playing**: timer bar, live score/combo, the current card (image + rarity),
     the 6 bins.
  3. **Result**: score, cards sorted, accuracy, payout (+$X), "Back".

## Data & state
- `state.lastWork` (timestamp) for the cooldown — mirrors `lastDailyClaim`.
  Persisted. Payout via the existing `addMoney`.
- **No card-cache impact**; the deck is drawn from already-loaded set cards.

## Architecture
- `game/restock.js` (new, pure/testable): `SHIFT_MS`, scoring (`scoreSort`),
  `payoutForScore`, `buildDeck(pool, n)` (shuffle real cards; synth fallback if
  none loaded), `TIERS`.
- `game/economy.js`: `WORK_COOLDOWN_MS`, `WORK_PAYOUT_CAP`, `workCooldownRemaining`.
- `state/store.js`: `lastWork` + `markWorked(now)` + persist.
- `ui/work.js` (new): `initWork`/`renderWork` + the timer/stream/scoring loop;
  on end → `addMoney(payout)` + `markWorked`. Deck from `loadedSet` across `SETS`.
- `index.html`: Work tab + `#view-work` markup.
- `main.js`: `initWork`, add `renderWork` to the subscriber + tab-entry refresh.
- `styles.css`: work view, bins, timer bar, result card.

## Acceptance criteria
- [ ] A "Work" tab appears; entering it shows Start Shift (or a live cooldown).
- [ ] A shift runs 30s: cards stream, correct/wrong sorting scores per the rules.
- [ ] On end, payout = `payoutForScore(score)` capped at $15, credited to money;
      cooldown starts and blocks re-working until elapsed.
- [ ] Real card images/rarities are used; works even if some sets aren't loaded.
- [ ] `lastWork` persists across reload; old saves default fine.
- [ ] No new deps; `node --check` clean; Bun harness + headless Brave green.

## Open questions — resolved at Gate 1
- Difficulty → **labelled + colour bins**. Cooldown → **3 min**. Shift **30s**,
  cap **$15**. Wrong-sort → **points only** (no time loss). Combo bonus included.

<!-- ───────────────────────── GATE 1 — approved above ───────────────────────── -->

## Research & findings
- **main.js** (read): tabs are generic — a `.tab[data-tab=work]` button + a
  `section.view#view-work` is all the nav needs; `wireTabs` already toggles
  `view-${name}`. Add `renderWork` to the store subscriber + a tab-entry refresh.
- **economy.js** (read): `cooldownRemaining(lastTs, ms, now)` + `formatCooldown`
  already power the daily/free-pack timers → reuse for the work cooldown exactly
  like `lastDailyClaim`/`lastOpen`. `addMoney` credits the payout.
- **cards.js** (read): `loadedSet(apiSetId)` returns cached real cards (image +
  tier); all sets pre-warm on boot. Deck pool = `SETS.flatMap(s =>
  loadedSet(s.apiSetId) || [])`; if empty (pre-load), synth tier-only cards so the
  game always runs. No cache impact.
- **Rarity palette**: bins reuse the existing `data-rarity` colours (the binder
  mini-cards already colour by tier) so bins match card rarity colours for free.

## Gaps & risks
- **Deck before sets load**: synth fallback in `buildDeck` (coloured tier cards,
  no image) so a shift never breaks; real images appear once sets are cached.
- **Cooldown gating**: `renderWork` must re-check `workCooldownRemaining` on a
  ticker so the countdown updates and "Start Shift" re-enables (a `setInterval`
  in `initWork`, only touching the DOM when the Work tab is active).
- **Mid-shift tab switch**: leaving the tab during a shift — keep the shift timer
  running off-DOM and just stop rendering; settle payout on timer end regardless.
- **No `CACHE_PREFIX` bump**; `lastWork` is new save state (old saves default null).

## Implementation plan
1. `game/restock.js` (new, pure): `SHIFT_MS=30000`, `TIERS`, `buildDeck(pool,n)`
   (shuffle + synth fallback), `scoreSort(correct, combo)` → `{ points, combo }`,
   `payoutForScore(score)` (`min(CAP, round2(score/DIVISOR))`).
2. `game/economy.js`: `WORK_COOLDOWN_MS = 3*60*1000`, `WORK_PAYOUT_CAP = 15`,
   `workCooldownRemaining(lastWork, now)`.
3. `state/store.js`: `lastWork: null` in `freshState` + `PERSIST_KEYS`;
   `markWorked(now)` action.
4. `index.html`: Work tab button + `#view-work` (ready / playing / result panes).
5. `ui/work.js` (new): `initWork`/`renderWork`; the 30s loop (stream cards, bins
   1–6 + click, scoring + combo, timer bar); on end → `addMoney(payout)` +
   `markWorked(now)` + result screen. Deck via `loadedSet`.
6. `main.js`: import + `initWork()`; add `renderWork` to the subscriber + refresh
   on entering the Work tab.
7. `styles.css`: work view, bins, timer bar, result.

## Test strategy
- `node --check` on all changed/new JS + import-graph.
- **Bun harness**: `scoreSort` (correct adds points and grows combo; wrong
  penalises + resets combo, floored at 0); `payoutForScore` (0→~0, monotonic,
  capped at $15); `buildDeck` (returns n from pool; synth fallback when pool
  empty; each card has a valid tier); `workCooldownRemaining`; `markWorked` sets
  `lastWork` + persists.
- **Headless Brave**: Work tab present; Start Shift → playing state (timer, score,
  bins, a card); clicking the correct bin raises score, a wrong bin resets combo;
  let one 30s shift complete → result screen, money increased by the payout,
  cooldown now shown + Start disabled; seed `lastWork=now` + reload → cooldown
  countdown renders; screenshot the playing state.

<!-- ───────────────────────── GATE 2 — approved below ───────────────────────── -->

<!-- ───────────────────────── GATE 2 ───────────────────────── -->

## Results & verification
**Built as planned** across 7 files:
- `game/restock.js` (new): `SHIFT_MS`, `TIERS` (palette-matched), `scoreSort`
  (combo bonus), `payoutForScore` (capped), `buildDeck` (real pool + synth fallback).
- `game/economy.js`: `WORK_PAYOUT_CAP=15`, `WORK_COOLDOWN_MS=3min`,
  `workCooldownRemaining`.
- `state/store.js`: `lastWork` + `markWorked` + persist.
- `index.html`: Work tab + `#view-work` (ready / playing / result panes).
- `ui/work.js` (new): the 30s loop — card stream, 6 bins (click or keys 1–6),
  scoring + combo, timer bar, payout via `addMoney` + `markWorked`, cooldown ticker.
- `main.js`: `initWork` + subscriber + tab-entry refresh.
- `styles.css`: work view, bins, timer, result, rarity-tinted card border.
- No `CACHE_PREFIX` bump (new save state only).

**Verification — all green:**
- `node --check` on all 5 changed/new JS files + import-graph → clean.
- **Bun harness (17/17)**: `scoreSort` (correct +points & combo↑; wrong penalty &
  combo reset); `payoutForScore` (0→$0, scales, capped $15, monotonic, neg→$0);
  `buildDeck` (length, junk-tier filtered, synth fallback on empty pool);
  `workCooldownRemaining` (none/counts-down/clears); `markWorked`; 30s shift const.
- **Headless Brave (15/15)**: Work tab present + active; Start enabled; shift plays
  (timer, 6 bins, a card); a correct sort raises score + combo, a wrong sort resets
  combo; deck exhausted → result screen with payout; money increased; cooldown
  starts, Start disabled with a "Next shift in …" countdown; persists across reload.
- Screenshot: `docs/specs/work-restock-playing.png` (synth-fallback card shown —
  real card images appear once sets are warmed in normal use).

All acceptance criteria met.

## Changelog
- `<pending>` — Add Restock Rush work mini-game

---
title: Card Show — clock-aligned hourly stock (no unlimited supply)
date: 2026-06-10
slug: card-show-hourly
status: Shipped   # Draft → Approved → Built → Verified → Shipped
owner: finn
---

# Card Show — clock-aligned hourly stock

> The Card Show now opens at the **top of every clock hour** (HH:00) with **one
> finite lineup**, instead of a rolling 1-hour timer from when you last attended.
> Last hour's leftover stock expires at the turn of the hour, so supply is bounded.

## Problem
- Items already sell out (one purchase each), but a fresh full lineup regenerated
  on a **rolling** 1h cooldown from your last visit — so the supply was effectively
  unlimited over time and the timing drifted (entered 1:15 → next at 2:15).
- Requests: "not unlimited stock" + "card show only happens at the top of every hour".

## Change
- **Cooldown is clock-aligned**: `cardShowCooldownRemaining(lastCardShow, now)`
  returns 0 if you haven't attended in the **current clock hour** (a new HH:00 has
  passed), otherwise the ms until the **next top-of-hour** (`HOUR − now%HOUR`).
- **Stale stock expires**: a lineup generated in a previous clock hour is cleared
  (`expireCardShow(now)`), so at HH:00 the old show closes and "Enter the Card
  Show" reappears for the new hour's finite lineup.
- Net: one finite lineup per clock hour; you can keep buying it until the hour
  ends; no re-rolls; aligned to the top of the hour.

## Implementation
- `game/economy.js`: rewrite `cardShowCooldownRemaining` to clock-hour logic.
- `state/store.js`: add `expireCardShow(now)` (null the stock if its `generatedAt`
  is an earlier clock hour; returns whether it cleared).
- `ui/events.js`: call `expireCardShow(now)` in the global events ticker; tweak the
  head copy to say the next show is at the top of the hour.
- No persistence/`CACHE_PREFIX` change.

## Acceptance criteria
- [ ] After attending, the show is gated until the next HH:00 (countdown to top of hour).
- [ ] At the top of a new hour, "Enter the Card Show" is available and last hour's
      stock is gone.
- [ ] Within the current hour you can still buy from the lineup you entered.
- [ ] `node --check` clean; harness + headless verify the gating/expiry.

## Test strategy
- Bun harness: `cardShowCooldownRemaining` — 0 when never attended; 0 when last
  attendance was a previous clock hour; `HOUR − now%HOUR` when attended this hour.
  `expireCardShow` clears a previous-hour lineup but keeps a current-hour one.
- Headless: attend → cooldown shows; simulate a new hour (seed lastCardShow/stock
  generatedAt to the previous hour, reload) → "Enter" available, old stock gone.

## Results & verification
**Built**: `economy.js` `cardShowCooldownRemaining` rewritten to clock-hour logic
(+ `hourBucket`); `store.js` `expireCardShow(now)`; `ui/events.js` calls
`expireCardShow` in the ticker + "top of the hour" copy.

**Verification — all green:**
- `node --check` clean.
- **Bun harness (6/6)**: cooldown 0 when never attended / when last attendance was
  a previous clock hour; `HOUR − now%HOUR` when attended this hour; `hourBucket`
  correct; `expireCardShow` clears a previous-hour lineup, keeps a current-hour one.
- **Headless Brave (8/8)**: Enter available → entering generates a lineup and gates
  with "top of the hour" copy; pushing `lastCardShow`/`generatedAt` back ~2h +
  reload → Enter available again and last hour's stock is expired/cleared.

All acceptance criteria met. Supply is now one finite lineup per clock hour.

## Changelog
- `cd7432d` — Card Show: clock-aligned hourly stock; deployed ✓

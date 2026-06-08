# PokéPack — realism rebuild: real cards, real images, real prices, free PE pack

## Context
The v2 app works, but pricing is wrong and the cause is structural. We show a **generic species** ("Bulbasaur") and then loosely name-search pokemontcg.io for *some* matching card — so Bulbasaur resolves to a $24 Illustration Rare from *Mega Evolution* instead of the ~$0.30 common it should be. Root cause: our invented rarity tiers don't map to real card rarity strings, and "a Bulbasaur" isn't a priceable thing — only *a specific printing* (set + number + variant) is.

Per the interview, the fix is to make **real printings the game**: each pull is a specific real card from a real set, shown with its **real card image**, priced at its **exact market price**, with **real-rarity-derived odds**. Direction is a realistic collecting/value sim. Additionally, the **first/default pack is Prismatic Evolutions, free** — no shard cost, gated by a **60-second cooldown** between opens — as the on-ramp before the shard economy.

Set lineup: **Prismatic Evolutions (`sv8pt5`) free** + three paid real sets bought with shards: **151 (`sv3pt5`)**, **Surging Sparks (`sv8`)**, **Paldean Fates (`sv4pt5`)**. Card look: **real image with minimal chrome** (thin rarity-tier border + price tag; subtle holo shimmer only on hits).

This replaces the generic-species data model. `data/pokemon.js` and `services/sprites.js` become obsolete; the neon-frame-with-sprite card rendering is replaced by real card images.

## Data source (confirmed against the live API)
`GET https://api.pokemontcg.io/v2/cards?q=set.id:<id>&pageSize=250&orderBy=number` returns every card in a set with: real `rarity` string, `number`, `images.large`, and `tcgplayer.prices` per variant. One request loads a whole set (180 cards for PE). Keyless is fine at our volume (one request per set per cache-refresh).

## New / changed architecture

**`src/services/cards.js` (new) — the real-card loader.**
- `loadSet(apiSetId)`: returns normalized cards for a set. Checks an in-memory map, then `localStorage` (`pokepack.set.<id>` = `{fetchedAt, cards}`, TTL ~24h so prices stay fresh-ish), else fetches the API and caches. Returns a Promise; on network failure falls back to any cached copy.
- Normalizes each API card to:
  `{ uid, name, number, rarity, tier, setId, setName, image, price, prices }`
  where `tier` is our bucket (see mapper) and `price` is the canonical market price (prefer `holofoil` > `reverseHolofoil` > `normal` > any; fall back to a rarity floor).
- `rarityToTier(str)`: keyword mapper from real rarity strings → `common | uncommon | rare | holo | ultra | secret`. e.g. "Common"→common, "Uncommon"→uncommon, "Rare"/"Rare Holo"→rare, "Double Rare"→holo, "Ultra Rare"/"ACE SPEC Rare"→ultra, "Special Illustration Rare"/"Hyper Rare"/"Illustration Rare"→secret. Robust default by keyword so it works across all four sets' differing strings.

**`src/data/sets.js` (rewrite) — real sets.**
Each entry: `{ id, apiSetId, name, blurb, cost, cooldownMs, pack, theme }`.
- PE: `cost: 0, cooldownMs: 60000`. The three others: shard `cost`, `cooldownMs: 0`.
- `pack`: slot list driving composition + a `rareSlot` weight table over tiers, e.g. `['common','common','common','common','uncommon','uncommon','reverse','rare-slot']` with `rareSlot: [{tier:'rare',w:50},{tier:'holo',w:28},{tier:'ultra',w:15},{tier:'secret',w:7}]`. Odds are marked indicative in the UI.

**`src/game/packs.js` (rewrite) — roll from real cards.**
`generatePack(set, cards)`: for each slot, pick a tier (fixed, or weighted for `rare-slot`), filter `cards` by that tier (fallback to whole set if empty), pick one at random. The `reverse` slot picks a common/uncommon and flags it reverse-holo (uses its `reverseHolofoil` price when present). Keep `bestRarity()` for fanfare/particle intensity (now keyed on `tier`).

**`src/game/economy.js` (small change).**
Generalize the daily-cooldown helper into `cooldownRemaining(lastTs, cooldownMs, now)` (reuse for both the free-pack 60s timer and the daily reward). `sellValue(card)` reads `card.price` (real) × haircut.

**`src/game/achievements.js` (update).**
Drop the `POKEMON`/`regionOf` dependency. Tier-based achievements (first holo/ultra/secret, etc.) read from the binder's `card.tier`. Set-completion checks "own N cards from set X" using the loaded set's card count (or printedTotal) rather than the old region buckets.

**`src/state/store.js` (update).**
- Binder keyed by **`uid`** (specific printing), not species name. `addCards` keys on `uid`; wishlist stores `uid`s.
- Add `lastOpen` map (`{ [setId]: timestamp }`) for cooldown sets; persist it.
- Keep shards/daily/sell/duplicates; sell + portfolio value use the real `card.price` directly (no async lookup).

**`src/services/prices.js` (gut).**
Remove the name-search `fetchPrice`/`pickBestCard`/`extractMarketPrice` machinery (the source of the $24 bug). Keep only `formatPrice` and the rarity-floor fallback used by `cards.js`. No more per-card async price fetches anywhere.

**`src/ui/*` updates.**
- `pack.js`: picker shows each set with **cost or "FREE"**; selecting a set triggers `loadSet` (show a "loading set…" state on the pack until ready, instant once cached) and applies theme. Open flow: for the free set, gate on `cooldownRemaining` and show a **live countdown** (a `setInterval` updating the hint/button, cleared on open); for paid sets, gate on shards as today. Reveal renders **real card images**.
- `card.js`: render the real `card.image` filling the face + thin rarity-tier border + price tag + holo shimmer only for holo/ultra/secret. Drop type backgrounds, HP, sprite logic.
- `binder.js`, `shop.js`, `modal.js`: use `card.image` and `card.price` (synchronous now); key/sort/sell by `uid`; modal shows set name + number + variant.
- `stats.js`: portfolio = Σ `count × card.price`.
- Remove `services/sprites.js`, `data/pokemon.js` (obsolete). The old prototype HTML stays for reference.

## Build order
1. `services/cards.js` (loader + tier mapper + cache) — verify against live API for all 4 sets.
2. `data/sets.js` rewrite (4 real sets, PE free+60s).
3. `game/packs.js` rewrite + `economy.js` cooldown generalize; smoke-test pack rolls against fetched data.
4. `store.js` (uid-keyed binder, `lastOpen`, persistence) + `achievements.js` rework.
5. `prices.js` gut; remove `sprites.js`/`pokemon.js`.
6. UI: `card.js` (real images), `pack.js` (loading + free/cooldown + countdown), then `binder.js`/`shop.js`/`modal.js`/`stats.js`.
7. `index.html`/`styles.css` tweaks for real-image cards + minimal chrome + cooldown display.

## Verification
- Node smoke test (like the v2 one, now with `node --input-type=module`): fetch each set via `cards.js` logic, assert every set yields all needed tiers, `generatePack` returns correct-size packs of real cards with non-null prices and image URLs, tier mapper covers every rarity string seen across the 4 sets (log any unmapped string).
- `bun run server.js` (the `import.meta.dir` fix is already in); load in a browser and verify: PE pack opens **free**, then the pack is **disabled with a live 60s countdown**; real card images render; prices match the cards (a PE common reads cents, a Leafeon ex SIR reads ~hundreds); switching to a paid set loads its cards and charges shards; sell duplicates pays real value; portfolio value is realistic; reload persists the uid-keyed binder + cooldown timer.
- Confirm pokemontcg.io is reached only once per set per session (cache hit on second select), and the app degrades gracefully (cached/fallback) if a fetch fails.

## Deferred (next phase, per interview)
Trading / market-sim (buy/sell specific cards at fluctuating market) and broader polish — built on top of this real-card foundation once it's solid.

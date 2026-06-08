# CLAUDE.md — POKÉPACK

Architecture & conventions for this project. Read this first; for the build
history see [`docs/dev-log-2026-06-08.md`](docs/dev-log-2026-06-08.md).

## How we build (spec-driven — do this by default)
Every non-trivial change in this repo goes through the **`spec-driven-development`**
skill (`.claude/skills/`): interview the user → write a spec in `docs/specs/` →
**Gate 1** (user approves the spec) → research, self-test, find gaps →
**Gate 2** (user approves research + plan) → build → verify → ship when asked.
Run it automatically for any feature/behavior change/refactor/non-trivial fix, or
when the user types `/spec`. Skip only for truly trivial one-liners (and say so).
Never write implementation code before Gate 2. Specs index: [`docs/specs/`](docs/specs/README.md).

## What it is
A neon retro-arcade Pokémon booster-pack opening simulator, built around **real
cards**: every pull is a specific real printing from a real set, shown with its
actual card image and priced at its real market value. Rip packs, build a binder,
collect sealed packs, play the money economy. Pure client-side; runs in the
browser. **Live: https://finnstevens.github.io/pokenet/**

## Hard constraints (do not violate)
- **Bun, never npm.** Bun is installed at `~/.bun/bin/bun` (v1.3.14).
- **Zero third-party packages.** No `node_modules`, no bundler, no transpile.
  Use native platform APIs (`Bun.serve`, native ES modules, Web Audio, canvas).
  If external code is ever truly needed, **vendor a snippet**, don't `bun add`
  it — the user treats every dependency as supply-chain attack surface.
- Keep it a static site (deployable to GitHub Pages as-is).

## Run / dev
- `bun run dev` → `server.js` (a ~30-line `Bun.serve` static server) on port 4321.
  Set `PORT` to change. (In a fresh shell, `bun` needs `~/.bun/bin` on PATH — the
  installer added it to `~/.zshrc`.)
- `package.json` has `"type": "module"` and **no dependencies**.

## Architecture
Vanilla JS + native ES modules. All cross-module state goes through a tiny
pub/sub store. No framework.

```
index.html            shell: top tabs (Shop|Binder), modal/toast/fx roots
server.js             Bun static dev server (import.meta.dir — NOT import.meta.url)
styles/styles.css     all styling
assets/packs/<id>.png real booster-wrapper art, one per set id
src/
  main.js             boot: load() → init modules → subscribe(renderAll) → wireTabs
  data/sets.js        the set catalog (see "Adding a set")
  state/store.js      state object + subscribe/notify + localStorage persistence + actions
  game/
    packs.js          generatePack(set, cards), bestRarity(); packAverageValue() (now unused)
    economy.js        money constants, sellValue, sellDurationMs, cooldownRemaining
    achievements.js   tier/value/count milestones, checkAchievements(state)
  services/
    cards.js          loadSet(apiSetId) + rarityToTier() + price normalization + cache
    prices.js         RARITY_FALLBACK floors + formatPrice (card pricing lives in cards.js)
    audio.js          Web Audio synthesized SFX (no asset files)
  ui/
    pack.js           pack picker + open/reveal flow + keep-sealed + open-from-sealed
    card.js           reveal card markup (real image)
    binder.js         Cards/Sealed subtabs, filters/search/sort, sealed grid
    shop.js           Buy/Sell subtabs, daily reward, sale queue, sell + bulk-sell
    stats.js, modal.js, toast.js, fx.js   stats bar, card detail, toasts, particles/haptics
```

Data flow: a module calls a `store.js` action → action mutates `state` + `commit()`
(debounced save + `notify()`) → the `main.js` subscriber re-renders stats, pack
picker, binder, shop.

## Real-card system (`services/cards.js`) — the core
- `loadSet(apiSetId)`: ONE request `GET pokemontcg.io/v2/cards?q=set.id:<id>&pageSize=250`,
  normalizes each card, caches in memory + `localStorage` key `pokepack.set.v3.<id>`
  (24h TTL). Falls back to any cached copy on network failure. All sets are
  pre-warmed on boot (`pack.js`) so the picker is correct immediately.
- Normalized card: `{ uid, name, number, rarity, tier, setId, setName, image, price, prices }`.
  `uid` = the API id (e.g. `sv8pt5-6`); the binder is **keyed by uid**.
- `rarityToTier(str)`: keyword map of real rarity strings → six tiers
  `common|uncommon|rare|holo|ultra|secret`. Order matters: check `uncommon`
  before `common`; `special illustration`→secret before `illustration`→holo;
  `\bex\b`→ultra (ex-era "Rare Holo EX") before `holo`; bare `holo`→holo (vintage
  "Rare Holo"). Adding a set with a new rarity string? extend this map.
- **Card price = the average of the card's variant market prices** (TCGplayer
  `market`, never `low`). The reverse-holo slot re-prices to `reverseHolofoil`
  in `packs.js`. Missing prices fall back to `RARITY_FALLBACK[tier]`.
- **If you change normalization/pricing, bump `CACHE_PREFIX`** (`.v3.` → `.v4.`)
  so cached set data is recomputed.

## Pricing model (two different things — don't conflate)
- **Card price** = real averaged market value (above). Accurate; verified.
- **Pack price** = each set's **real sealed single-pack market price**, hardcoded
  as `cost`/`sealedPrice` in `sets.js` (the card API has no sealed-product
  prices). `costOf(set)` in `pack.js` just returns `set.cost`. This is why
  vintage packs are expensive (Base Set ~$350, Fossil ~$110) — opening one is a
  high-buy-in gamble. NOT the average value of the contents.

## Economy (`game/economy.js` + `state/store.js`)
- Currency is **money = US dollars** (same unit as card prices). Start $15, daily
  reward $5.
- **Selling** lands in a FIFO `pendingSales` **queue** — only the front card
  actively counts down (`sellDurationMs`, ~2–10s by tier); pays out one at a
  time at `sellValue = card.price × 0.7` (haircut). `processSales(now)` runs on a
  250ms ticker in `shop.js`.
- **Bulk sell** ("all commons & uncommons") queues every eligible unlocked copy.
- **Lock** a card (binder modal) → excluded from selling.
- **Sealed packs**: "Keep Sealed" buys a pack but banks it unopened
  (`state.sealed[setId]`); open later from Binder ▸ Sealed.
- Daily reward + free PE pack both use `cooldownRemaining(lastTs, ms, now)`.

## UI structure
- Top tabs (`#tabs`): **Shop** (default) and **Binder**.
- **Shop** subtabs (`#shop-subtabs`): **Buy** (pack picker + rip + keep-sealed +
  reveal) and **Sell** (daily reward, market listings, sell cards, bulk).
- **Binder** subtabs (`#binder-subtabs`): **Pokémon Cards** (rarity/wishlist
  filters, search, sort, detail modal) and **Pokémon Sealed** (held sealed packs).

## Adding a set (the common task)
1. Find the set on `pokemontcg.io` (`/v2/sets?q=name:"…"`) — confirm it has card
   prices + images; note the `id` (the `apiSetId`).
2. Get a real wrapper image: TCGplayer product CDN
   `https://product-images.tcgplayer.com/<productId>.jpg` (find the booster-pack
   product id via search), or a retailer `og:image`. Trim white margins with PIL
   if needed; downscale with `sips -Z 640`; save to `assets/packs/<your-id>.png`.
3. Add an entry to `SETS` in `src/data/sets.js`:
   `{ id, apiSetId, name, blurb, cost, sealedPrice, cooldownMs, pack:{slots, rareSlot}, theme }`.
   - `slots`: array of `'common'|'uncommon'|'rare'|'reverse'|'rare-slot'`.
   - `rareSlot`: weighted tiers — **only include tiers the set actually has**
     (else a roll falls back to a random card). Vintage sets have no `reverse`.
   - `cost`/`sealedPrice` = real sealed pack market price (hand-set).
4. The pack art loads by convention (`assets/packs/<id>.png`); missing → logo+gradient fallback.

## Persistence
`localStorage`:
- `pokepack.save.v2` — the save (money, binder by uid, sealed, wishlist, locked,
  pendingSales, achievements, timers, UI tab/filter/sort). A migration maps the
  old `shards` field → `money`.
- `pokepack.set.v3.<apiSetId>` — cached set card data (24h TTL).

## Hosting / deploy
- Repo: **github.com/finnstevens/pokenet** (`main`). `gh` CLI at `~/.local/bin/gh`.
- **GitHub Pages via Actions** (`.github/workflows/deploy.yml`): every push to
  `main` auto-deploys (~30–60s). `.nojekyll` present.
- Flow: edit → `bun run dev` to test → commit + push. Watch: `gh run watch`.

## Verify without a browser
- Parse: `node --check --input-type=module < file.js` (package is `type:module`).
- Import graph: a throwaway script that checks every relative named import
  resolves to a real export (used repeatedly this session).
- Logic: import the non-DOM modules in a Bun `.mjs` and exercise
  loadSet/generatePack/economy. Bun has global `fetch`; `localStorage` is guarded
  so it no-ops outside the browser.
- DOM/interaction: drive headless **Brave** (Chromium, at
  `/Applications/Brave Browser.app/...`) via the DevTools Protocol over a Bun
  WebSocket — seed `localStorage`, reload, click, read DOM. (Used to verify
  bulk-sell, sealed flow, shop subtabs.)
- Screenshots: Brave `--headless=new --screenshot=… --virtual-time-budget=…`.
  Note Brave/network needs the unsandboxed Bash path.

## Gotchas / environment notes
- **`é` in the path**: use `import.meta.dir` (decoded), not `import.meta.url`
  (percent-encoded) — see `server.js`.
- **Homebrew is broken** here (`/usr/local` Intel install errors on the macOS
  version). A working native arm64 brew is at `/opt/homebrew/bin/brew`, but it
  has permission issues — prefer downloading binaries directly (that's how `gh`
  was installed).
- **macOS screenshot filenames** use a narrow no-break space, not a normal space
  — glob them, don't type the path.
- Image tools available: `sips` (resize/convert) and Python **PIL/Pillow** (trim).
- Bump `CACHE_PREFIX` in `cards.js` whenever card normalization/pricing changes.

## Known caveats
- **Ascended Heroes (`me2pt5`)**: brand-new set; `pokemontcg.io` has no live
  prices and no secret-tier rarities for it yet → card values are placeholders
  (rarity floors), self-healing once the data source populates.
- Vintage **sealed pack prices are hand-set approximations** (no sealed-product
  API); tweak in `sets.js` anytime.
- `packAverageValue()` in `packs.js` is currently unused (kept from the old
  contents-EV pricing model) — harmless; remove if you like.

## Deferred / possible next steps
Trading / market sim (buy/sell specific cards at fluctuating market); sealed-pack
appreciation over time; faster bulk-sell option; broader polish.

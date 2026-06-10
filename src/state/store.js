/* Central app state + persistence. A tiny pub/sub store — modules read from
   `state`, mutate via the action helpers, and re-render in subscribers. The
   persisted slice is saved to localStorage (debounced) on every commit and
   reloaded on boot. No framework, no dependencies.

   Cards are real printings now, so the binder is keyed by card `uid`
   (e.g. "sv8pt5-6", or "sv8pt5-6:rev" for a reverse-holo pull). */

import { STARTING_MONEY, sellValue, sellDurationMs, DAILY_REWARD, dailyCooldownRemaining,
         GRADING_FEE, gradingDurationMs, gradedValue, slabSellValue } from '../game/economy.js';
import { checkAchievements } from '../game/achievements.js';
import { rollCentering, currentExposure, conditionFrom, computeGrade } from '../game/grading.js';
import { makeSellLot, aiStep } from '../game/auction.js';
import { FREE_SET_ID } from '../data/sets.js';

const STORAGE_KEY = 'pokepack.save.v2';

function freshState() {
  return {
    money: STARTING_MONEY,
    packsOpened: 0,
    totalCards: 0,
    binder: {},          // uid -> { card, count }
    pendingSales: [],    // [{ id, card, value, listedAt, readyAt }]
    wishlist: [],        // [uid]
    locked: [],          // [uid] — protected from selling
    sealed: {},          // set.id -> count of sealed packs held (unopened)
    boxes: {},           // set.id -> number[] of held booster boxes, each = its packs remaining
    sleeves: 0,          // count of unused card sleeves in inventory
    sleeved: [],         // [uid] — cards in a sleeve (protected from selling; preserves condition)
    grading: [],         // [{ id, uid, card, grade, value, startedAt, readyAt }] — in-progress submissions
    graded: [],          // [{ id, uid, card, grade, value, gradedAt }] — finished slabs
    achievements: [],    // [achievementId]
    lastDailyClaim: null,
    lastWork: null,      // timestamp of the last completed work shift (cooldown)
    lastCardShow: null,  // timestamp of the last card-show entry (1h cooldown)
    cardShowStock: null, // { generatedAt, items[] } — the current show's lineup
    auctions: [],        // [{ id, card, market, reserve, currentBid, aiMax, endsAt, aiNextAt }] — active sell lots
    lastOpen: {},        // setId -> timestamp (for cooldown-gated sets)
    selectedSet: FREE_SET_ID,

    // UI-only
    currentFilter: 'all',
    binderTab: 'cards',  // 'cards' | 'sealed'
    shopTab: 'buy',      // 'buy' | 'sell'
    sort: 'rarity',
    search: '',
  };
}

export const state = freshState();

/* ---- persistence ---- */
const PERSIST_KEYS = [
  'money', 'packsOpened', 'totalCards', 'binder', 'pendingSales', 'wishlist', 'locked', 'sealed', 'boxes',
  'sleeves', 'sleeved', 'grading', 'graded',
  'achievements', 'lastDailyClaim', 'lastWork', 'lastCardShow', 'cardShowStock', 'auctions',
  'lastOpen', 'selectedSet', 'currentFilter', 'binderTab', 'shopTab', 'sort',
];

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const slice = {};
      for (const k of PERSIST_KEYS) slice[k] = state[k];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
    } catch (err) {
      console.warn('Save failed', err);
    }
  }, 250);
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const slice = JSON.parse(raw);
    for (const k of PERSIST_KEYS) {
      if (slice[k] !== undefined) state[k] = slice[k];
    }
    // Migrate old "shards" saves (1 USD ≈ 10 shards) to dollar money.
    if (slice.money === undefined && slice.shards !== undefined) {
      state.money = +(slice.shards / 10).toFixed(2);
    }
  } catch (err) {
    console.warn('Load failed — starting fresh', err);
  }
}

/* ---- pub/sub ---- */
const subscribers = new Set();
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
function notify() { for (const fn of subscribers) fn(state); }
function commit() { save(); notify(); }

/* ---- derived ---- */
export function uniqueCount() { return Object.keys(state.binder).length; }
export function secretCount() {
  return Object.values(state.binder).filter(e => e.card.tier === 'secret').length;
}
export function portfolioValue() {
  return Object.values(state.binder).reduce((s, e) => s + (e.card.price || 0) * e.count, 0);
}
/* Every owned card — all are sellable (the last copy can be sold too). */
export function sellableCards() {
  return Object.values(state.binder).filter(e => e.count >= 1);
}

/* ---- actions ---- */

/* A new binder stack carries condition state for grading: an intrinsic centering
   roll (fixed) plus exposure tracking (it starts exposed unless already sleeved). */
function freshBinderEntry(card, now) {
  return {
    card, count: 0,
    centering: rollCentering(),
    pulledAt: now,
    exposedMs: 0,
    exposeStart: state.sleeved.includes(card.uid) ? null : now,
  };
}
/* Backfill condition fields on pre-existing/older-save entries on first need. */
function ensureCondition(entry, now) {
  if (entry.centering === undefined) {
    entry.centering = rollCentering();
    entry.pulledAt = entry.pulledAt || now;
    entry.exposedMs = entry.exposedMs || 0;
    entry.exposeStart = state.sleeved.includes(entry.card.uid) ? null : now;
  }
  return entry;
}

/* Add a batch of pulled cards to the binder (keyed by uid). Returns
   newly-unlocked achievements so the caller can toast them. */
export function addCards(cards) {
  const now = Date.now();
  cards.forEach(card => {
    if (!state.binder[card.uid]) state.binder[card.uid] = freshBinderEntry(card, now);
    state.binder[card.uid].count++;
  });
  state.totalCards += cards.length;
  state.packsOpened++;
  const unlocked = checkAchievements(state);
  commit();
  return unlocked;
}

/* Add several packs at once (e.g. ripping a whole booster box). Banks every
   card, counts each pack toward packsOpened, and commits/notifies ONCE (so a
   36-pack rip doesn't trigger 36 re-renders). `packArrays` is an array of packs,
   each pack an array of cards. Returns newly-unlocked achievements. */
export function addPacks(packArrays) {
  const now = Date.now();
  packArrays.forEach(pack => {
    pack.forEach(card => {
      if (!state.binder[card.uid]) state.binder[card.uid] = freshBinderEntry(card, now);
      state.binder[card.uid].count++;
    });
    state.totalCards += pack.length;
    state.packsOpened++;
  });
  const unlocked = checkAchievements(state);
  commit();
  return unlocked;
}

/* Record that a cooldown-gated set was just opened. */
export function markOpened(setId, now) {
  state.lastOpen[setId] = now;
  commit();
}

export function spendMoney(n) {
  if (state.money < n) return false;
  state.money = +(state.money - n).toFixed(2);
  commit();
  return true;
}

export function addMoney(n) {
  state.money = +(state.money + n).toFixed(2);
  checkAchievements(state);
  commit();
}

/* List one copy of a card (by uid) for sale. Any owned card is sellable;
   listing the last copy removes it from the binder. Sales aren't instant and
   sell ONE AT A TIME: `pendingSales` is a queue where only the front card is
   actively counting down (has a `readyAt`); the rest are queued (`readyAt`
   null) until their turn. Returns the created sale, or null. */
export function listForSale(uid, now) {
  const entry = state.binder[uid];
  if (!entry || entry.count < 1) return null;
  if (state.locked.includes(uid)) return null;  // protected from selling
  if (state.sleeved.includes(uid)) return null; // sleeved cards are protected too
  const card = entry.card;
  entry.count--;
  if (entry.count <= 0) delete state.binder[uid];

  const duration = sellDurationMs(card);
  const isFront = state.pendingSales.length === 0;
  const sale = {
    id: `${now}-${Math.floor(Math.random() * 1e6)}`,
    card,
    value: sellValue(card),
    duration,
    // The front sale starts ticking immediately; queued sales wait.
    listedAt: isFront ? now : null,
    readyAt: isFront ? now + duration : null,
  };
  state.pendingSales.push(sale);
  commit();
  return sale;
}

/* List every unlocked common & uncommon (all copies) onto the sale queue in one
   press — they sell one at a time like any other listing (not an instant
   payout). Returns { count, total } where total is the estimated proceeds. */
export function bulkSellCommonsUncommons(now) {
  let count = 0, total = 0;
  for (const [uid, e] of Object.entries(state.binder)) {
    if ((e.card.tier === 'common' || e.card.tier === 'uncommon') && !state.locked.includes(uid) && !state.sleeved.includes(uid)) {
      const card = e.card;
      const value = sellValue(card);
      for (let i = 0; i < e.count; i++) {
        const duration = sellDurationMs(card);
        const isFront = state.pendingSales.length === 0; // only the head ticks; rest queue
        state.pendingSales.push({
          id: `${now}-${count}-${Math.floor(Math.random() * 1e6)}`,
          card,
          value,
          duration,
          listedAt: isFront ? now : null,
          readyAt: isFront ? now + duration : null,
        });
        total += value;
        count++;
      }
      delete state.binder[uid];
    }
  }
  if (!count) return { count: 0, total: 0 };
  commit();
  return { count, total: +total.toFixed(2) };
}

/* Advance the sale queue: activate the front sale if it hasn't started, and
   complete it once its timer elapses (crediting money), then activate the next.
   Sells one card at a time. Returns completed sales (for toasts). */
export function processSales(now) {
  if (!state.pendingSales.length) return [];
  const front = state.pendingSales[0];

  if (front.readyAt == null) {            // front just reached the head of the queue — start it
    front.listedAt = now;
    front.readyAt = now + front.duration;
    commit();
    return [];
  }
  if (now < front.readyAt) return [];      // still selling

  const done = state.pendingSales.shift(); // completed
  state.money = +(state.money + done.value).toFixed(2);
  const next = state.pendingSales[0];      // start the next one
  if (next && next.readyAt == null) {
    next.listedAt = now;
    next.readyAt = now + next.duration;
  }
  checkAchievements(state);
  commit();
  return [done];
}

/* Record that a work shift just finished (starts the cooldown). */
export function markWorked(now) {
  state.lastWork = now;
  commit();
}

/* ---- card show event ---- */

/* Enter the show: set the freshly-generated lineup and start the 1h cooldown. */
export function enterCardShow(stock, now) {
  state.cardShowStock = stock;
  state.lastCardShow = now;
  commit();
}

/* Route a granted show item into the right inventory and mark it sold.
   single → binder (gradeable, no packsOpened bump), pack → sealed, box → boxes.
   Does NOT charge money or commit — callers do that. */
function grantShowItem(item, now) {
  if (item.kind === 'single') {
    const c = item.card;
    if (!state.binder[c.uid]) state.binder[c.uid] = freshBinderEntry(c, now);
    state.binder[c.uid].count++;
    state.totalCards++;
  } else if (item.kind === 'pack') {
    state.sealed[item.setId] = (state.sealed[item.setId] || 0) + 1;
  } else if (item.kind === 'box') {
    if (!state.boxes[item.setId]) state.boxes[item.setId] = [];
    state.boxes[item.setId].push(item.packs);
  }
  item.sold = true;
}

/* Buy one item from the current show lineup for cash. Returns { ok, item } /
   { error } / null. */
export function buyShowItem(itemId, now) {
  const stock = state.cardShowStock;
  if (!stock) return null;
  const item = stock.items.find(i => i.id === itemId && !i.sold);
  if (!item) return null;
  if (state.money < item.price) return { error: 'money' };

  state.money = +(state.money - item.price).toFixed(2);
  grantShowItem(item, now);
  checkAchievements(state);
  commit();
  return { ok: true, item };
}

/* Trade binder cards (+ a cash top-up) for a show item. `offeredUids` is a list
   of binder uids, one copy each. Trade-ins are credited at the dealer haircut
   (`sellValue`, 0.7× market); you pay only the cash shortfall. Locked/sleeved
   cards can't be offered. Returns { ok, item, cashPaid, credit } / { error }. */
export function tradeForShowItem(itemId, offeredUids, now) {
  const stock = state.cardShowStock;
  if (!stock) return null;
  const item = stock.items.find(i => i.id === itemId && !i.sold);
  if (!item) return null;
  if (!offeredUids || !offeredUids.length) return { error: 'empty' };

  const need = {};
  for (const uid of offeredUids) need[uid] = (need[uid] || 0) + 1;
  let credit = 0;
  for (const [uid, n] of Object.entries(need)) {
    const e = state.binder[uid];
    if (!e || e.count < n) return { error: 'invalid' };
    if (state.locked.includes(uid) || state.sleeved.includes(uid)) return { error: 'protected' };
    credit += sellValue(e.card) * n;
  }
  credit = +credit.toFixed(2);
  const cashNeeded = Math.max(0, +(item.price - credit).toFixed(2));
  if (state.money < cashNeeded) return { error: 'money' };

  for (const [uid, n] of Object.entries(need)) {
    state.binder[uid].count -= n;
    if (state.binder[uid].count <= 0) delete state.binder[uid];
  }
  if (cashNeeded > 0) state.money = +(state.money - cashNeeded).toFixed(2);
  grantShowItem(item, now);
  checkAchievements(state);
  commit();
  return { ok: true, item, cashPaid: cashNeeded, credit };
}

/* ---- auction house (sell-only: consign a card with a reserve, AI bids it up) ---- */

/* Consign one copy of a binder card to auction with a reserve price. Escrows the
   card (removes it from the binder) and creates a sell lot. Returns { ok } /
   { error }. */
export function consignCard(uid, reserve, now) {
  const e = state.binder[uid];
  if (!e || e.count < 1) return { error: 'invalid' };
  if (state.locked.includes(uid) || state.sleeved.includes(uid)) return { error: 'protected' };
  if (!(reserve > 0)) return { error: 'reserve' };
  const card = e.card;
  e.count--;
  if (e.count <= 0) delete state.binder[uid];
  state.auctions.push(makeSellLot(card, reserve, now));
  commit();
  return { ok: true };
}

/* Advance + settle auctions. Climbs due lots; on a lot's end: reserve met → pay
   the final bid; reserve missed → return the card to the binder. Removes settled
   lots. Returns settle outcomes (for toasts). Runs on a global ticker. */
export function processAuctions(now) {
  if (!state.auctions.length) return [];
  const outcomes = [];
  const remaining = [];
  let changed = false;
  for (const lot of state.auctions) {
    if (now >= lot.endsAt) {
      if (lot.currentBid >= lot.reserve) {
        state.money = +(state.money + lot.currentBid).toFixed(2);
        outcomes.push({ type: 'sold', card: lot.card, amount: lot.currentBid });
      } else {
        const c = lot.card;
        if (!state.binder[c.uid]) state.binder[c.uid] = freshBinderEntry(c, now);
        state.binder[c.uid].count++;
        outcomes.push({ type: 'unsold', card: lot.card, bid: lot.currentBid, reserve: lot.reserve });
      }
      changed = true; // lot dropped (not pushed to remaining)
    } else {
      if (aiStep(lot, now)) changed = true;
      remaining.push(lot);
    }
  }
  if (changed) {
    state.auctions = remaining;
    checkAchievements(state);
    commit();
  }
  return outcomes;
}

export function claimDaily(now) {
  if (dailyCooldownRemaining(state.lastDailyClaim, now) > 0) return 0;
  state.lastDailyClaim = now;
  state.money = +(state.money + DAILY_REWARD).toFixed(2);
  checkAchievements(state);
  commit();
  return DAILY_REWARD;
}

export function toggleWishlist(uid) {
  const i = state.wishlist.indexOf(uid);
  if (i >= 0) state.wishlist.splice(i, 1);
  else state.wishlist.push(uid);
  commit();
}
export function isWished(uid) { return state.wishlist.includes(uid); }

export function toggleLock(uid) {
  const i = state.locked.indexOf(uid);
  if (i >= 0) state.locked.splice(i, 1);
  else state.locked.push(uid);
  commit();
}
export function isLocked(uid) { return state.locked.includes(uid); }

/* ---- card sleeves (consumable inventory; sleeved cards are protected) ---- */
export function addSleeves(n) {
  state.sleeves = Math.max(0, state.sleeves + n);
  commit();
}
export function isSleeved(uid) { return state.sleeved.includes(uid); }
/* Sleeve a card (consumes one sleeve) or un-sleeve it (refunds the sleeve).
   Returns { sleeved } on success, or null if trying to sleeve with none left. */
export function toggleSleeve(uid) {
  const now = Date.now();
  const entry = state.binder[uid];
  const i = state.sleeved.indexOf(uid);
  if (i >= 0) {                      // un-sleeve → refund + resume condition decay
    state.sleeved.splice(i, 1);
    state.sleeves++;
    if (entry) { ensureCondition(entry, now); entry.exposeStart = now; }
    commit();
    return { sleeved: false };
  }
  if (state.sleeves <= 0) return null; // none to apply
  state.sleeves--;
  state.sleeved.push(uid);
  if (entry) {                       // sleeve → freeze condition (bank open exposure)
    ensureCondition(entry, now);
    if (entry.exposeStart) { entry.exposedMs += now - entry.exposeStart; entry.exposeStart = null; }
  }
  commit();
  return { sleeved: true };
}

/* ---- grading (submit → wait → slab; slabs sell at graded value) ---- */

/* Submit one copy of a card for grading: charge the fee, consume the copy, and
   queue a job. The grade is computed now (from the card's fixed centering + its
   condition frozen at submission) but only revealed when the job completes.
   Returns the job, or null if not owned / can't afford. */
export function submitForGrading(uid, now) {
  const entry = state.binder[uid];
  if (!entry || entry.count < 1) return null;
  if (state.money < GRADING_FEE) return null;
  ensureCondition(entry, now);
  const condition = conditionFrom(currentExposure(entry, now));
  const grade = computeGrade(entry.centering, condition);
  const card = entry.card;
  const value = gradedValue(card.price, grade);

  state.money = +(state.money - GRADING_FEE).toFixed(2);
  entry.count--;
  if (entry.count <= 0) delete state.binder[uid];

  const job = {
    id: `${now}-${Math.floor(Math.random() * 1e6)}`,
    uid, card, grade, value,
    startedAt: now,
    readyAt: now + gradingDurationMs(card),
  };
  state.grading.push(job);
  commit();
  return job;
}

/* Complete any grading jobs whose timer has elapsed → move them to `graded`
   slabs. Returns the newly-finished slabs (for toasts). Runs on the shop ticker. */
export function processGrading(now) {
  if (!state.grading.length) return [];
  const done = [], remaining = [];
  for (const job of state.grading) {
    if (now >= job.readyAt) {
      done.push({ id: job.id, uid: job.uid, card: job.card, grade: job.grade, value: job.value, gradedAt: now });
    } else {
      remaining.push(job);
    }
  }
  if (!done.length) return [];
  state.grading = remaining;
  state.graded.push(...done);
  checkAchievements(state);
  commit();
  return done;
}

/* List a slab for sale at its graded value (minus the haircut). Reuses the
   pendingSales queue — the sale's card snapshot carries the PSA grade label. */
/* Lock / unlock a slab so it can't be accidentally sold. Lock state rides on the
   slab object (persisted with state.graded). */
export function toggleSlabLock(slabId) {
  const slab = state.graded.find(s => s.id === slabId);
  if (!slab) return null;
  slab.locked = !slab.locked;
  commit();
  return { locked: slab.locked };
}

export function listSlabForSale(slabId, now) {
  const idx = state.graded.findIndex(s => s.id === slabId);
  if (idx < 0) return null;
  if (state.graded[idx].locked) return null; // locked slabs are protected
  const [slab] = state.graded.splice(idx, 1);
  const value = slabSellValue(slab);
  const duration = sellDurationMs(slab.card);
  const isFront = state.pendingSales.length === 0;
  const sale = {
    id: `${now}-${Math.floor(Math.random() * 1e6)}`,
    card: { ...slab.card, name: `${slab.card.name} (PSA ${slab.grade})` },
    value,
    duration,
    listedAt: isFront ? now : null,
    readyAt: isFront ? now + duration : null,
  };
  state.pendingSales.push(sale);
  commit();
  return sale;
}

export function setSelectedSet(id) { state.selectedSet = id; commit(); }
export function setFilter(f)       { state.currentFilter = f; commit(); }
export function setBinderTab(t)    { state.binderTab = t; commit(); }
export function setShopTab(t)      { state.shopTab = t; commit(); }

/* ---- sealed packs (held, unopened) ---- */
export function addSealed(setId) {
  state.sealed[setId] = (state.sealed[setId] || 0) + 1;
  commit();
}
export function consumeSealed(setId) {
  if (!state.sealed[setId]) return false;
  state.sealed[setId]--;
  if (state.sealed[setId] <= 0) delete state.sealed[setId];
  commit();
  return true;
}
/* Bank n loose sealed packs at once (e.g. taking all packs out of a box). */
export function addSealedMany(setId, n) {
  if (n <= 0) return;
  state.sealed[setId] = (state.sealed[setId] || 0) + n;
  commit();
}

/* ---- booster boxes (held; each box tracks its own remaining packs) ---- */

/* Add one full booster box (with `packs` packs remaining) to the holdings. */
export function addBox(setId, packs) {
  if (!state.boxes[setId]) state.boxes[setId] = [];
  state.boxes[setId].push(packs);
  commit();
}
/* Index of the most-opened (fewest remaining) box for a set, or -1 if none.
   Targeting the most-opened box first means partial boxes get finished before
   fresh ones, and behavior is deterministic with multiple boxes. */
function mostOpenedBoxIdx(setId) {
  const arr = state.boxes[setId];
  if (!arr || !arr.length) return -1;
  let idx = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] < arr[idx]) idx = i;
  return idx;
}
/* Open one pack from the most-opened box: decrement it, dropping the box when it
   hits zero. Returns true if a pack was consumed. */
export function consumeBoxPack(setId) {
  const idx = mostOpenedBoxIdx(setId);
  if (idx < 0) return false;
  const arr = state.boxes[setId];
  arr[idx]--;
  if (arr[idx] <= 0) arr.splice(idx, 1);
  if (!arr.length) delete state.boxes[setId];
  commit();
  return true;
}
/* Remove the most-opened box entirely and return its remaining pack count (0 if
   none). Used by "Rip a box" and "Take out packs". */
export function takeBox(setId) {
  const idx = mostOpenedBoxIdx(setId);
  if (idx < 0) return 0;
  const arr = state.boxes[setId];
  const [n] = arr.splice(idx, 1);
  if (!arr.length) delete state.boxes[setId];
  commit();
  return n;
}
/* Total packs remaining across all of a set's held boxes. */
export function boxPacksRemaining(setId) {
  return (state.boxes[setId] || []).reduce((a, b) => a + b, 0);
}
export function setSort(s)         { state.sort = s; commit(); }
export function setSearch(q)       { state.search = q; notify(); }

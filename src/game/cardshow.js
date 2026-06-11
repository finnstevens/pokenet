/* Card Show stock generation (pure, testable). Singles are organised into a few
   SELLERS — you explore a seller's collection to find cards. Collections are
   hit-weighted (~80% rare/holo/ultra/secret), so few commons/uncommons are sold.
   Plus a few discounted sealed packs and a discounted box. No DOM here.
   `items` stays a flat array (singles tagged with `sellerId`, + packs + box) so
   the buy/trade-by-id logic in the store is unchanged. */

import { RARITY_FALLBACK } from '../services/prices.js';

export const SELLERS_COUNT = 3;
export const CARDS_PER_SELLER = 8;
export const PACKS_COUNT = 3;
const DEALS = 3;           // how many singles (across the show) are below-market deals
const SHOW_DISCOUNT = 0.9; // packs/box are 10% off at the show

const SELLER_NAMES = [
  'Vintage Vera', 'Holo Hank', 'Mint Marv', 'Gem-Mint Gigi', 'Binder Bob',
  'Slab Sally', 'Toploader Tom', 'Rare Renee', 'First-Edition Fred', 'Chase Cho',
];

// Target tier mix for a seller's collection — ~80% hits (rare+), few non-hits.
const SELLER_DIST = [
  { tier: 'common', w: 10 }, { tier: 'uncommon', w: 10 },
  { tier: 'rare', w: 25 }, { tier: 'holo', w: 25 }, { tier: 'ultra', w: 20 }, { tier: 'secret', w: 10 },
];
// Fallback preference when a rolled tier has no (unused) card — hits first.
const FALLBACK_ORDER = ['secret', 'ultra', 'holo', 'rare', 'uncommon', 'common'];

function priceOf(card) {
  return card.price || RARITY_FALLBACK[card.tier] || 0.5;
}

function pickN(arr, n) {
  const a = arr.slice(), out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}

function availableIn(buckets, tier, used) {
  return (buckets[tier] || []).filter(c => !used.has(c.uid));
}

/* Draw one unused card by the hit-weighted tier distribution, falling back to the
   next available tier (hits first). Marks it used. Returns null if pool exhausted. */
function drawSellerCard(buckets, used) {
  let total = 0;
  for (const d of SELLER_DIST) total += d.w;
  let r = Math.random() * total, tier = SELLER_DIST[0].tier;
  for (const d of SELLER_DIST) { r -= d.w; if (r <= 0) { tier = d.tier; break; } }
  for (const t of [tier, ...FALLBACK_ORDER]) {
    const av = availableIn(buckets, t, used);
    if (av.length) {
      const c = av[Math.floor(Math.random() * av.length)];
      used.add(c.uid);
      return c;
    }
  }
  return null;
}

/* Generate a lineup. `pool` = real cards (from loaded sets); `sets` = the SETS
   catalog. `now` seeds item ids. Returns { generatedAt, items, sellers }. */
export function generateStock(pool, sets, now) {
  let idx = 0;
  const id = () => `cs-${now}-${idx++}`;
  const items = [];
  const sellers = [];

  // Bucket the pool by tier for the hit-weighted draw.
  const buckets = { common: [], uncommon: [], rare: [], holo: [], ultra: [], secret: [] };
  for (const c of pool) if (buckets[c.tier]) buckets[c.tier].push(c);
  const used = new Set();

  // --- sellers, each with a hit-weighted collection of singles ---
  for (const name of pickN(SELLER_NAMES, SELLERS_COUNT)) {
    const sid = `s-${now}-${sellers.length}`;
    sellers.push({ id: sid, name });
    for (let k = 0; k < CARDS_PER_SELLER; k++) {
      const c = drawSellerCard(buckets, used);
      if (!c) break;
      const list = +priceOf(c).toFixed(2);
      items.push({ id: id(), kind: 'single', sellerId: sid, card: c, price: list, listPrice: list, deal: false });
    }
  }
  // A few priciest singles become "deals" (chase bargains).
  const singles = items.filter(i => i.kind === 'single');
  const dealUids = new Set([...singles].sort((a, b) => b.listPrice - a.listPrice).slice(0, DEALS).map(i => i.card.uid));
  for (const it of singles) {
    if (dealUids.has(it.card.uid)) {
      it.deal = true;
      it.price = +(it.listPrice * (1 - (0.4 + Math.random() * 0.25))).toFixed(2); // 40–65% off
    }
  }

  // --- packs (paid sets, show discount) ---
  for (const s of pickN(sets.filter(s => s.cost > 0), PACKS_COUNT)) {
    items.push({ id: id(), kind: 'pack', setId: s.id, setName: s.name, image: `./assets/packs/${s.id}.png`,
      price: +(s.cost * SHOW_DISCOUNT).toFixed(2), listPrice: s.cost, deal: false });
  }

  // --- one box (boxed sets, show discount) ---
  const boxSets = sets.filter(s => s.box);
  if (boxSets.length) {
    const s = boxSets[Math.floor(Math.random() * boxSets.length)];
    items.push({ id: id(), kind: 'box', setId: s.id, setName: s.name, image: `./assets/packs/${s.id}.png`,
      packs: s.box.packs, price: +(s.box.price * SHOW_DISCOUNT).toFixed(2), listPrice: s.box.price, deal: false });
  }

  return { generatedAt: now, items, sellers };
}

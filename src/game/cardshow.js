/* Card Show stock generation (pure, testable). Builds a one-time lineup of real
   single cards (market price, with a couple of below-market deals), a few packs,
   and a box — all at a small show discount. The singles draw is weighted toward
   rarer cards so there's a chase. No DOM here. */

import { RARITY_FALLBACK } from '../services/prices.js';

export const SINGLES_COUNT = 6;
export const PACKS_COUNT = 3;
const DEALS = 2;            // how many singles are below-market deals
const SHOW_DISCOUNT = 0.9; // packs/box are 10% off at the show

// Draw weight by tier — biased toward chase cards (there's always something good).
const TIER_WEIGHT = { common: 1, uncommon: 1.6, rare: 2.6, holo: 4, ultra: 6, secret: 8 };

function priceOf(card) {
  return card.price || RARITY_FALLBACK[card.tier] || 0.5;
}

function weightedPick(pool) {
  let total = 0;
  for (const c of pool) total += TIER_WEIGHT[c.tier] || 1;
  let r = Math.random() * total;
  for (const c of pool) {
    r -= TIER_WEIGHT[c.tier] || 1;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

function pickN(arr, n) {
  const a = arr.slice(), out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}

/* Generate a lineup. `pool` = real cards (from loaded sets); `sets` = the SETS
   catalog. `now` seeds item ids. Returns { generatedAt, items }. */
export function generateStock(pool, sets, now) {
  let idx = 0;
  const id = () => `cs-${now}-${idx++}`;
  const items = [];

  // --- singles (weighted, unique) ---
  const used = new Set();
  const singles = [];
  let guard = 0;
  while (singles.length < SINGLES_COUNT && guard++ < SINGLES_COUNT * 25 && pool.length) {
    const c = weightedPick(pool);
    if (used.has(c.uid)) continue;
    used.add(c.uid);
    singles.push(c);
  }
  // The priciest couple become "deals" (chase bargains).
  const dealUids = new Set([...singles].sort((a, b) => priceOf(b) - priceOf(a)).slice(0, DEALS).map(c => c.uid));
  for (const c of singles) {
    const list = +priceOf(c).toFixed(2);
    const deal = dealUids.has(c.uid);
    const discount = deal ? 0.4 + Math.random() * 0.25 : 0; // 40–65% off
    items.push({ id: id(), kind: 'single', card: c, price: +(list * (1 - discount)).toFixed(2), listPrice: list, deal });
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

  return { generatedAt: now, items };
}

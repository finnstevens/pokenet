/* Real-card loader. Fetches a whole set from pokemontcg.io in one request,
   normalizes each card (real image + real per-variant market price + a derived
   rarity tier), and caches the result in memory and localStorage so we only hit
   the network once per set per day.

   This is the heart of the realism rebuild: a "card" is now a specific real
   printing (set + number + variant), not a generic species. Price is that
   card's actual market price — no more name-search guessing. */

import { RARITY_FALLBACK } from './prices.js';

const API = 'https://api.pokemontcg.io/v2/cards';
const CACHE_PREFIX = 'pokepack.set.v2.'; // bump to invalidate caches with old (foil-first) prices
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh prices ~daily

const memo = new Map();      // apiSetId -> normalized cards[]
const inflight = new Map();  // apiSetId -> Promise

/* Our six gameplay tiers, derived from the many real rarity strings. Order of
   checks matters: more specific strings are matched first, and "uncommon" is
   checked before "common" (since "uncommon" contains "common"). Covers every
   rarity string seen across PE / 151 / Surging Sparks / Paldean Fates, plus
   older-set strings (secret/rainbow/gold) for forward-compatibility. */
export function rarityToTier(rarityStr) {
  const s = (rarityStr || '').toLowerCase();
  if (!s) return 'common';
  if (s.includes('secret') || s.includes('rainbow') || s.includes('gold')) return 'secret';
  if (s.includes('shiny')) return s.includes('ultra') ? 'secret' : 'holo';
  if (s.includes('hyper')) return 'secret';
  if (s.includes('special illustration')) return 'secret';
  if (s.includes('illustration')) return 'holo';
  if (s.includes('ace spec')) return 'ultra';
  if (s.includes('ultra')) return 'ultra';
  if (s.includes('double')) return 'holo';
  if (s.includes('uncommon')) return 'uncommon';
  if (s.includes('rare')) return 'rare';
  if (s.includes('common')) return 'common';
  return 'rare';
}

/* Pick the price of the variant that matches what the card actually IS.
   Base-rarity cards (common/uncommon/rare) are priced at their plain `normal`
   printing — NOT the reverse-holo, which trades at a premium and would wildly
   overprice an ordinary pull. Holo/ultra/secret cards use their foil price.
   (A card pulled in the reverse-holo slot is re-priced to reverseHolofoil in
   game/packs.js — there the premium is correct.) */
const FOIL_FIRST = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal', 'unlimited', '1stEditionNormal'];
const BASE_FIRST = ['normal', 'unlimited', '1stEditionNormal', 'reverseHolofoil', 'holofoil', '1stEditionHolofoil', 'unlimitedHolofoil'];
const FOIL_TIERS = new Set(['holo', 'ultra', 'secret']);

function bestVariantPrice(prices, tier) {
  if (!prices) return null;
  const order = FOIL_TIERS.has(tier) ? FOIL_FIRST : BASE_FIRST;
  const tryGet = v => {
    const p = prices[v];
    if (!p) return null;
    const val = p.market ?? p.mid ?? null;
    return val != null ? { price: val, variant: v } : null;
  };
  for (const v of order) { const r = tryGet(v); if (r) return r; }
  for (const v of Object.keys(prices)) { const r = tryGet(v); if (r) return r; }
  return null;
}

/* Variant -> market price, for the slots that want a specific variant
   (e.g. a reverse-holo slot prefers the reverseHolofoil price). */
function variantPrices(prices) {
  const out = {};
  if (!prices) return out;
  for (const [v, p] of Object.entries(prices)) {
    const val = p?.market ?? p?.mid ?? null;
    if (val != null) out[v] = val;
  }
  return out;
}

/* Normalize one API card into our internal shape. Pure — testable in Node. */
export function normalizeCard(c) {
  const tier = rarityToTier(c.rarity);
  const prices = variantPrices(c.tcgplayer?.prices);
  const best = bestVariantPrice(c.tcgplayer?.prices, tier);
  const price = best?.price ?? RARITY_FALLBACK[tier] ?? 0.25;
  return {
    uid: c.id,                                   // e.g. "sv8pt5-6" — unique per printing
    name: c.name,
    number: c.number,
    rarity: c.rarity || 'Common',                // real rarity string (shown in UI)
    tier,                                         // our gameplay bucket
    setId: c.set?.id || '',
    setName: c.set?.name || '',
    image: c.images?.large || c.images?.small || '',
    price,                                        // canonical market price (USD)
    prices,                                       // variant -> price
  };
}

/* Normalize a full API response. Pure — testable in Node. */
export function normalizeSet(apiJson) {
  return (apiJson?.data || []).map(normalizeCard);
}

/* ---- caching (browser only; guarded so Node import is safe) ---- */
function readCache(apiSetId) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + apiSetId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeCache(apiSetId, cards) {
  try {
    localStorage.setItem(CACHE_PREFIX + apiSetId, JSON.stringify({ fetchedAt: Date.now(), cards }));
  } catch { /* quota / unavailable — fine, memory cache still works */ }
}

/* Load a set's normalized cards. Memory -> fresh localStorage -> network,
   falling back to any cached copy (even stale) if the network fails. */
export async function loadSet(apiSetId) {
  if (memo.has(apiSetId)) return memo.get(apiSetId);
  if (inflight.has(apiSetId)) return inflight.get(apiSetId);

  const cached = readCache(apiSetId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    memo.set(apiSetId, cached.cards);
    return cached.cards;
  }

  const url = `${API}?q=set.id:${apiSetId}&pageSize=250&orderBy=number`;
  const promise = fetch(url)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(json => {
      const cards = normalizeSet(json);
      memo.set(apiSetId, cards);
      writeCache(apiSetId, cards);
      inflight.delete(apiSetId);
      return cards;
    })
    .catch(err => {
      console.warn('loadSet failed for', apiSetId, err);
      inflight.delete(apiSetId);
      if (cached) { memo.set(apiSetId, cached.cards); return cached.cards; } // stale fallback
      throw err;
    });

  inflight.set(apiSetId, promise);
  return promise;
}

/* Synchronous accessor for already-loaded sets (UI render paths). */
export function loadedSet(apiSetId) {
  return memo.get(apiSetId) || null;
}

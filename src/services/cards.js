/* Real-card loader. Fetches a whole set from pokemontcg.io in one request,
   normalizes each card (real image + real per-variant market price + a derived
   rarity tier), and caches the result in memory and localStorage so we only hit
   the network once per set per day.

   This is the heart of the realism rebuild: a "card" is now a specific real
   printing (set + number + variant), not a generic species. Price is that
   card's actual market price — no more name-search guessing. */

import { RARITY_FALLBACK } from './prices.js';

const API = 'https://api.pokemontcg.io/v2/cards';
const CACHE_PREFIX = 'pokepack.set.v4.'; // bump to recompute (v4: GX/VMAX → ultra tiering)
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
  if (s.includes('vmax') || s.includes('vstar')) return 'ultra'; // SWSH big hits (check before holo)
  if (/\bgx\b/.test(s)) return 'ultra';            // SM "Rare Holo GX" (before holo)
  if (/\bex\b/.test(s)) return 'ultra';            // ex-era "Rare Holo EX"
  if (s.includes('double')) return 'holo';
  if (s.includes('holo')) return 'holo';           // vintage "Rare Holo", SWSH "Rare Holo V"
  if (s.includes('uncommon')) return 'uncommon';
  if (s.includes('rare')) return 'rare';
  if (s.includes('common')) return 'common';
  return 'rare';
}

/* The canonical price is the AVERAGE of the card's variant market prices, not
   the cheapest single variant. Each variant's own figure is TCGplayer's
   "market" (a rolling average of real sales), so this blends, e.g., a card's
   normal and reverse-holo printings into one representative value rather than
   showing only the lowest. (A card pulled specifically in the reverse-holo slot
   is still priced at its reverseHolofoil figure in game/packs.js.) */
function averagePrice(variantMap) {
  const vals = Object.values(variantMap);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
  const avg = averagePrice(prices);
  const price = avg != null ? +avg.toFixed(2) : (RARITY_FALLBACK[tier] ?? 0.25);
  return {
    uid: c.id,                                   // e.g. "sv8pt5-6" — unique per printing
    name: c.name,
    number: c.number,
    rarity: c.rarity || 'Common',                // real rarity string (shown in UI)
    tier,                                         // our gameplay bucket
    setId: c.set?.id || '',
    setName: c.set?.name || '',
    image: c.images?.large || c.images?.small || '',
    price,                                        // avg of variant market prices (USD)
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

/* Fetch a set with retry + backoff. The public pokemontcg.io API (no key) rate-
   limits bursts, so on a network error or a 429/5xx we wait and retry a few times
   before giving up — this keeps cold-start loads (many sets at once) resilient. */
async function fetchSetJson(url, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      lastErr = new Error('HTTP ' + r.status);
      if (r.status !== 429 && r.status < 500) throw lastErr; // non-retryable client error
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      const wait = 500 * Math.pow(2, i) + Math.floor(Math.random() * 300); // 0.5s,1.1s,2.3s…
      await new Promise(res => setTimeout(res, wait));
    }
  }
  throw lastErr;
}

/* Load a set's normalized cards. Memory -> fresh localStorage -> network (with
   retry/backoff), falling back to any cached copy (even stale) if it still fails. */
export async function loadSet(apiSetId) {
  if (memo.has(apiSetId)) return memo.get(apiSetId);
  if (inflight.has(apiSetId)) return inflight.get(apiSetId);

  const cached = readCache(apiSetId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    memo.set(apiSetId, cached.cards);
    return cached.cards;
  }

  const url = `${API}?q=set.id:${apiSetId}&pageSize=250&orderBy=number`;
  const promise = fetchSetJson(url)
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

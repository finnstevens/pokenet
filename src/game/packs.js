/* Pack generation from a real set's card list. Each slot resolves to a tier,
   then we pick a random real card of that tier (falling back to the whole set
   if a tier happens to be empty). The reverse slot picks a low-rarity card and
   re-prices it to its reverse-holo variant so a "reverse" pull reads true. */

function rand(n) { return Math.floor(Math.random() * n); }
function pickFromPool(pool) { return pool[rand(pool.length)]; }

function pickWeighted(weights) {
  const total = weights.reduce((s, w) => s + w.w, 0);
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.w;
    if (r <= 0) return w.tier;
  }
  return weights[weights.length - 1].tier;
}

function poolOf(cards, tier) {
  const inTier = cards.filter(c => c.tier === tier);
  return inTier.length ? inTier : cards;
}

/* A reverse-holo pull: a common/uncommon shown as its reverse variant, priced
   from reverseHolofoil when the card has that variant. */
function makeReverse(cards) {
  const base = poolOf(cards, Math.random() < 0.6 ? 'common' : 'uncommon');
  const card = pickFromPool(base);
  const reversePrice = card.prices?.reverseHolofoil;
  return {
    ...card,
    uid: card.uid + ':rev',                 // distinct binder entry from the plain printing
    variant: 'reverseHolofoil',
    isReverse: true,
    price: reversePrice ?? card.price,
  };
}

function rollSlot(set, cards, slot) {
  if (slot === 'reverse') return makeReverse(cards);
  const tier = slot === 'rare-slot' ? pickWeighted(set.pack.rareSlot) : slot;
  return pickFromPool(poolOf(cards, tier));
}

export function generatePack(set, cards) {
  if (!cards || !cards.length) return [];
  return set.pack.slots.map(slot => rollSlot(set, cards, slot));
}

/* Highest tier in a pack — drives fanfare / particle intensity. */
const RANK = { common: 0, uncommon: 1, rare: 2, holo: 3, ultra: 4, secret: 5 };

export function bestRarity(cards) {
  return cards.reduce((best, c) => (RANK[c.tier] > RANK[best] ? c.tier : best), 'common');
}

/* Average value of a pack from this set — the expected total card value across
   its slots, using each tier's average card price and the rare-slot odds. Used
   to price paid packs at their average worth (not an arbitrary cheap number). */
function avgPriceOfTier(cards, tier) {
  const pool = cards.filter(c => c.tier === tier);
  if (!pool.length) return 0;
  return pool.reduce((s, c) => s + (c.price || 0), 0) / pool.length;
}

function avgReverseValue(cards) {
  const pool = cards.filter(c => c.tier === 'common' || c.tier === 'uncommon');
  if (!pool.length) return 0;
  const vals = pool.map(c => c.prices?.reverseHolofoil ?? c.price ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function packAverageValue(set, cards) {
  if (!cards || !cards.length) return 0;
  let ev = 0;
  for (const slot of set.pack.slots) {
    if (slot === 'reverse') {
      ev += avgReverseValue(cards);
    } else if (slot === 'rare-slot') {
      const total = set.pack.rareSlot.reduce((s, w) => s + w.w, 0);
      for (const w of set.pack.rareSlot) ev += (w.w / total) * avgPriceOfTier(cards, w.tier);
    } else {
      ev += avgPriceOfTier(cards, slot);
    }
  }
  return ev;
}

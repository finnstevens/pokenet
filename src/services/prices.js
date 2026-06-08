/* Pricing helpers. Real prices now come baked into each card (see
   services/cards.js, which reads tcgplayer market prices straight from the set
   data). This module just holds the rarity-tier price floors used as a fallback
   when a specific card has no market data, plus the shared price formatter. */

/* Rough fallback values (USD) by tier, for cards the API has no price for —
   keeps the economy and portfolio value moving. */
export const RARITY_FALLBACK = {
  common: 0.1,
  uncommon: 0.25,
  rare: 0.75,
  holo: 3,
  ultra: 8,
  secret: 40,
};

export function formatPrice(price) {
  if (price == null) return '—';
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${Math.round(price).toLocaleString()}`;
}

/* The money economy. Currency is plain dollars — the same unit as card market
   prices — so cash, pack costs, sale proceeds, and collection value all read in
   one currency. The free Prismatic Evolutions pack is gated by a 60s cooldown
   (see data/sets.js); paid packs cost money. Selling a duplicate pays its real
   market value (minus a haircut); a daily login grants a top-up. */

import { RARITY_FALLBACK } from '../services/prices.js';

export const STARTING_MONEY = 15;   // dollars
export const DAILY_REWARD = 5;      // dollars

export const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20h, so "daily" is forgiving

/* You get back a fraction of market when selling (marketplace fees / spread —
   the sink that keeps the economy honest). */
const SELL_HAIRCUT = 0.7;

export function sellValue(card) {
  const usd = card.price ?? RARITY_FALLBACK[card.tier] ?? 0.25;
  return Math.max(0.01, +(usd * SELL_HAIRCUT).toFixed(2));
}

/* A sale isn't instant — the card is "listed" and takes a short time to sell.
   Kept relatively fast; scales modestly by rarity so grails feel weightier. */
const SELL_DURATIONS = {
  common: 2000,
  uncommon: 2500,
  rare: 3500,
  holo: 5000,
  ultra: 7000,
  secret: 10000,
};

export function sellDurationMs(card) {
  return SELL_DURATIONS[card.tier] ?? 3000;
}

export function canAfford(money, set) {
  return set.cost === 0 || money >= set.cost;
}

/* Generic cooldown: ms remaining until `lastTs + cooldownMs`, or 0 if ready.
   Used for both the free-pack 60s timer and the daily reward. */
export function cooldownRemaining(lastTs, cooldownMs, now) {
  if (!lastTs || !cooldownMs) return 0;
  return Math.max(0, cooldownMs - (now - lastTs));
}

export function dailyCooldownRemaining(lastClaim, now) {
  return cooldownRemaining(lastClaim, DAILY_COOLDOWN_MS, now);
}

export function formatCooldown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.ceil(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${totalMin}m`;
}

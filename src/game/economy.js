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

/* ---- grading ---- */
export const GRADING_FEE = 20; // dollars per submission (flat)

/* Grading takes longer than a sale; scales by tier so grails feel weightier. */
const GRADE_DURATIONS = {
  common: 12000, uncommon: 13000, rare: 15000, holo: 18000, ultra: 22000, secret: 26000,
};
export function gradingDurationMs(card) {
  return GRADE_DURATIONS[card.tier] ?? 15000;
}

/* Steep, realistic grade → value multiplier on the card's market price. High
   grades are a big payoff; low grades are a LOSS vs raw (grading is a gamble). */
const GRADE_MULT = { 10: 6, 9: 3, 8: 1.7, 7: 1.3, 6: 1.15, 5: 1, 4: 0.9, 3: 0.8, 2: 0.7, 1: 0.6 };
export function gradeMultiplier(grade) {
  return GRADE_MULT[grade] ?? 1;
}

/* A slabbed card's market value = raw market price × the grade multiplier. */
export function gradedValue(price, grade) {
  return +((price || 0) * gradeMultiplier(grade)).toFixed(2);
}

/* Selling a slab pays its graded value minus the standard haircut. */
export function slabSellValue(slab) {
  return Math.max(0.01, +((slab.value || 0) * SELL_HAIRCUT).toFixed(2));
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

/* ---- work mini-game (Restock Rush) ---- */
export const WORK_PAYOUT_CAP = 15;            // max dollars per shift
export const WORK_COOLDOWN_MS = 3 * 60 * 1000; // 3 min between shifts

export function workCooldownRemaining(lastWork, now) {
  return cooldownRemaining(lastWork, WORK_COOLDOWN_MS, now);
}

/* ---- card show event (clock-aligned: a new show at the top of every hour) ---- */
export const CARD_SHOW_COOLDOWN_MS = 60 * 60 * 1000; // one hour (kept for reference)

/* Which clock hour a timestamp falls in. */
export function hourBucket(ts) {
  return Math.floor(ts / CARD_SHOW_COOLDOWN_MS);
}

/* 0 if a show is available now (you haven't attended this clock hour); otherwise
   the ms until the next top-of-hour (HH:00). */
export function cardShowCooldownRemaining(lastCardShow, now) {
  if (!lastCardShow) return 0;
  if (hourBucket(lastCardShow) < hourBucket(now)) return 0; // a new clock hour began
  return CARD_SHOW_COOLDOWN_MS - (now % CARD_SHOW_COOLDOWN_MS); // attended this hour
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

/* Auction House — sell-only. You consign a card with a reserve price; AI bidders
   bid it up live over a countdown. Meets reserve → sold for the final bid; falls
   short → returned. Pure-ish logic here (Math.random for the AI); state lives in
   the store. */

import { RARITY_FALLBACK } from '../services/prices.js';

export const AUCTION_DURATION_MS = 35_000; // ~35s per lot
const AI_MIN = 0.6, AI_MAX = 1.4;          // hidden final value ≈ market × [0.6, 1.4]

let _seq = 0;
const clampMoney = n => Math.max(0.01, +(+n).toFixed(2));

/* Minimum raise for the next bid — ~10% steps, at least $1. */
export function bidIncrement(bid) {
  return clampMoney(Math.max(1, bid * 0.1));
}

function marketOf(card) {
  return card.price || RARITY_FALLBACK[card.tier] || 0.5;
}

/* Create a sell lot for a consigned card with a reserve (asking) price. */
export function makeSellLot(card, reserve, now) {
  const market = +marketOf(card).toFixed(2);
  const res = clampMoney(reserve);
  const aiMax = +(market * (AI_MIN + Math.random() * (AI_MAX - AI_MIN))).toFixed(2);
  return {
    id: `au-${now}-${_seq++}`,
    card, market,
    reserve: res,
    currentBid: clampMoney(Math.min(market, res) * 0.2), // opens low, climbs up
    aiMax,
    endsAt: now + AUCTION_DURATION_MS,
    aiNextAt: now + 800 + Math.random() * 2000,
  };
}

export function isEnded(lot, now) {
  return now >= lot.endsAt;
}

/* Advance a lot's AI bidding: climb the current bid toward aiMax on a cadence.
   Returns true if the lot changed. */
export function aiStep(lot, now) {
  if (now >= lot.endsAt) return false;
  if (lot.currentBid < lot.aiMax && now >= lot.aiNextAt) {
    lot.currentBid = Math.min(lot.aiMax, +(lot.currentBid + bidIncrement(lot.currentBid)).toFixed(2));
    lot.aiNextAt = now + 1000 + Math.random() * 2500; // next climb in 1–3.5s
    return true;
  }
  return false;
}

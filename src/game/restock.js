/* Restock Rush — the "day job" mini-game logic (pure, testable). Sort a stream
   of real cards into the right rarity bin before the timer runs out; score →
   payout (capped, see economy.js). No DOM here. */

import { WORK_PAYOUT_CAP } from './economy.js';

export const SHIFT_MS = 30_000; // a shift is 30 seconds

/* The six rarity bins, in display order, with their palette colour. */
/* Colours mirror the CSS rarity palette (--r-*). */
export const TIERS = [
  { tier: 'common',   label: 'Common',   color: '#b8b8c8' },
  { tier: 'uncommon', label: 'Uncommon', color: '#2ecc71' },
  { tier: 'rare',     label: 'Rare',     color: '#3498db' },
  { tier: 'holo',     label: 'Holo',     color: '#e91e63' },
  { tier: 'ultra',    label: 'Ultra',    color: '#ffd700' },
  { tier: 'secret',   label: 'Secret',   color: '#ff00e6' },
];
const TIER_SET = new Set(TIERS.map(t => t.tier));

/* Score one sort. Correct: base 10 + a combo bonus (grows the streak). Wrong:
   −5 (floored at 0) and the combo resets. Returns the delta + the new combo. */
export function scoreSort(isCorrect, combo) {
  if (isCorrect) {
    const next = combo + 1;
    const points = 10 + Math.min(next, 10) * 2; // up to +30 at a 10+ streak
    return { points, combo: next };
  }
  return { points: -5, combo: 0 };
}

/* Map a final score to a dollar payout, capped. Tuned so a strong 30s run
   (~score 900) hits the cap and a weak one pays a few dollars. */
const DIVISOR = 60;
export function payoutForScore(score) {
  const raw = Math.max(0, score) / DIVISOR;
  return Math.max(0, Math.min(WORK_PAYOUT_CAP, +raw.toFixed(2)));
}

/* Build a shuffled deck of n cards from a pool of real cards. Falls back to
   synthetic tier-only cards (no image) if the pool is empty, so a shift always
   runs. Each returned card has at least { tier }. */
export function buildDeck(pool, n) {
  const valid = (pool || []).filter(c => c && TIER_SET.has(c.tier));
  const out = [];
  if (valid.length) {
    const bag = valid.slice();
    for (let i = 0; i < n; i++) {
      if (!bag.length) bag.push(...valid);
      const j = Math.floor(Math.random() * bag.length);
      out.push(bag.splice(j, 1)[0]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const t = TIERS[Math.floor(Math.random() * TIERS.length)];
      out.push({ uid: `synth-${i}`, name: t.label, tier: t.tier, image: null, synthetic: true });
    }
  }
  return out;
}

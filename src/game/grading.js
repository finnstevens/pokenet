/* Card grading math. A card's grade (PSA-style 1–10) comes from two inputs,
   each in [0,1]:

   - centering: an intrinsic RNG rolled once when the card is first pulled and
     fixed forever — the luck of the pull; you can't change it.
   - condition: starts at 1.0 (mint) and decays only while the card is EXPOSED
     (not in a sleeve). Sleeving pauses the decay. So preserving a card (sleeve
     it, keep it sleeved, grade it before it ages) keeps condition high.

   Per Gate 1, condition is weighted higher than centering: preservation matters
   more than luck. The only randomness is the centering roll. */

export const EXPOSURE_CAP_MS = 60 * 60 * 1000; // 60 min fully exposed → condition 0
const CENTERING_W = 0.35;
const CONDITION_W = 0.65;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* Roll a card's intrinsic centering (uniform 0–1), fixed for the card's life. */
export function rollCentering() {
  return Math.random();
}

/* Condition from accumulated exposed time: 1.0 mint → 0 at the cap. */
export function conditionFrom(exposedMs) {
  return clamp(1 - (exposedMs || 0) / EXPOSURE_CAP_MS, 0, 1);
}

/* A binder entry's total exposure right now, including the open interval if the
   card is currently exposed (exposeStart set). */
export function currentExposure(entry, now) {
  const base = entry.exposedMs || 0;
  return entry.exposeStart ? base + (now - entry.exposeStart) : base;
}

/* The final grade (1–10), deterministic given centering + condition. */
export function computeGrade(centering, condition) {
  const q = CENTERING_W * clamp(centering, 0, 1) + CONDITION_W * clamp(condition, 0, 1);
  return clamp(Math.round(1 + q * 9), 1, 10);
}

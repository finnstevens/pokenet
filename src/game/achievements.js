/* Milestone achievements. Each has a `check(state)` predicate evaluated after
   pack opens / sales / claims. Newly-satisfied ones are surfaced as toasts and
   their ids stored in state.achievements so they fire once.

   Now keyed off real card data: gameplay tier, real market price, and set id —
   no dependency on a hardcoded species list. */

function entries(state) { return Object.values(state.binder); }
function uniqueCount(state) { return Object.keys(state.binder).length; }
function ownsTier(state, tier) { return entries(state).some(e => e.card.tier === tier); }
function maxCardValue(state) {
  return entries(state).reduce((m, e) => Math.max(m, e.card.price || 0), 0);
}
function portfolio(state) {
  return entries(state).reduce((s, e) => s + (e.card.price || 0) * e.count, 0);
}
/* Most unique cards owned from any single set. */
function maxFromOneSet(state) {
  const bySet = {};
  for (const e of entries(state)) {
    const id = e.card.setId || '?';
    bySet[id] = (bySet[id] || 0) + 1;
  }
  return Object.values(bySet).reduce((m, n) => Math.max(m, n), 0);
}

export const ACHIEVEMENTS = [
  { id: 'first-pack', title: 'First Rip',      desc: 'Open your first pack.',          check: s => s.packsOpened >= 1 },
  { id: 'packs-10',   title: 'Getting Hooked', desc: 'Open 10 packs.',                 check: s => s.packsOpened >= 10 },
  { id: 'packs-50',   title: 'Pack Addict',    desc: 'Open 50 packs.',                 check: s => s.packsOpened >= 50 },
  { id: 'packs-100',  title: 'Whale Status',   desc: 'Open 100 packs.',                check: s => s.packsOpened >= 100 },

  { id: 'first-holo',   title: 'Foil Hit',       desc: 'Pull your first holo/ex.',     check: s => ownsTier(s, 'holo') },
  { id: 'first-ultra',  title: 'Ultra Rare',     desc: 'Pull an ultra rare.',          check: s => ownsTier(s, 'ultra') },
  { id: 'first-secret', title: 'Chase Card!',    desc: 'Pull a secret/SIR/hyper rare.', check: s => ownsTier(s, 'secret') },

  { id: 'unique-25',  title: 'Collector', desc: 'Own 25 unique cards.',  check: s => uniqueCount(s) >= 25 },
  { id: 'unique-100', title: 'Curator',   desc: 'Own 100 unique cards.', check: s => uniqueCount(s) >= 100 },
  { id: 'unique-250', title: 'Archivist', desc: 'Own 250 unique cards.', check: s => uniqueCount(s) >= 250 },

  { id: 'big-pull',     title: 'Money Card',  desc: 'Pull a card worth $50+.',          check: s => maxCardValue(s) >= 50 },
  { id: 'grail',        title: 'Grail',       desc: 'Pull a card worth $200+.',         check: s => maxCardValue(s) >= 200 },
  { id: 'portfolio-1k', title: 'Heavy Bag',   desc: 'Reach a $1,000 collection value.', check: s => portfolio(s) >= 1000 },
  { id: 'set-50',       title: 'Set Hunter',  desc: 'Own 50 cards from one set.',       check: s => maxFromOneSet(s) >= 50 },
  { id: 'rich',         title: 'Cashed Up',   desc: 'Bank $100.',                       check: s => s.money >= 100 },
];

/* Returns newly-unlocked achievements; mutates state.achievements. */
export function checkAchievements(state) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.check(state)) {
      state.achievements.push(a.id);
      unlocked.push(a);
    }
  }
  return unlocked;
}

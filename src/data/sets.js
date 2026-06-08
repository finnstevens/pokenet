/* Real Pokémon TCG sets. Each set's cards are loaded live from pokemontcg.io
   by services/cards.js (keyed on apiSetId). Here we define how each set is
   monetized and how a pack from it is structured.

   - Prismatic Evolutions is the free starter pack: cost 0, gated by a 60s
     cooldown between opens.
   - The others cost money in dollars (earned by selling cards / daily reward).

   `pack.slots` lists the card slots in a booster. Each slot is either a fixed
   tier name, `'reverse'` (a common/uncommon shown as its reverse-holo variant),
   or `'rare-slot'` (a weighted roll over `pack.rareSlot`). Odds are an
   approximation of real pull rates and are labelled indicative in the UI. */

export const SETS = [
  {
    id: 'prismatic',
    apiSetId: 'sv8pt5',
    name: 'Prismatic Evolutions',
    blurb: 'FREE pack · one every 2min. Eeveelutions & the SIR chase.',
    cost: 0,
    cooldownMs: 120_000,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 48 },
        { tier: 'holo',   w: 30 },
        { tier: 'ultra',  w: 15 },
        { tier: 'secret', w: 7 },
      ],
    },
    theme: {
      '--accent': '#00f0ff', '--accent-glow': 'rgba(0,240,255,0.45)',
      '--pack-c1': '#00f0ff', '--pack-c2': '#b829ff', '--pack-c3': '#39ff14', '--pack-c4': '#ff2e9a',
    },
  },
  {
    id: '151',
    apiSetId: 'sv3pt5',
    name: '151',
    blurb: 'Kanto nostalgia. Chase the Charizard ex SIR.',
    cost: 23, // fallback; actual price = average pack value, computed from live data
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 50 },
        { tier: 'holo',   w: 30 },
        { tier: 'ultra',  w: 14 },
        { tier: 'secret', w: 6 },
      ],
    },
    theme: {
      '--accent': '#ff2e9a', '--accent-glow': 'rgba(255,46,154,0.45)',
      '--pack-c1': '#ff2e9a', '--pack-c2': '#ffd700', '--pack-c3': '#00f0ff', '--pack-c4': '#b829ff',
    },
  },
  {
    id: 'surging',
    apiSetId: 'sv8',
    name: 'Surging Sparks',
    blurb: 'Electric-charged. Pikachu ex & big Illustration Rares.',
    cost: 7,
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 52 },
        { tier: 'holo',   w: 28 },
        { tier: 'ultra',  w: 14 },
        { tier: 'secret', w: 6 },
      ],
    },
    theme: {
      '--accent': '#fff200', '--accent-glow': 'rgba(255,242,0,0.45)',
      '--pack-c1': '#fff200', '--pack-c2': '#ff2e9a', '--pack-c3': '#00f0ff', '--pack-c4': '#b829ff',
    },
  },
  {
    id: 'paldean',
    apiSetId: 'sv4pt5',
    name: 'Paldean Fates',
    blurb: 'Shiny vault. Stuffed with shiny pulls + chase SIRs.',
    cost: 18,
    cooldownMs: 0,
    pack: {
      // shiny-heavy set: a dedicated shiny-friendly hit + a rare slot
      slots: ['common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'holo', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 40 },
        { tier: 'holo',   w: 34 },
        { tier: 'ultra',  w: 17 },
        { tier: 'secret', w: 9 },
      ],
    },
    theme: {
      '--accent': '#b829ff', '--accent-glow': 'rgba(184,41,255,0.5)',
      '--pack-c1': '#b829ff', '--pack-c2': '#ffd700', '--pack-c3': '#ff2e9a', '--pack-c4': '#00f0ff',
    },
  },
  {
    id: 'evolving',
    apiSetId: 'swsh7',
    name: 'Evolving Skies',
    blurb: 'Eeveelution alt arts. Chase the Moonbreon (Umbreon VMAX).',
    cost: 22, // fallback; actual price = average pack value, computed from live data
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 46 },
        { tier: 'holo',   w: 32 },
        { tier: 'ultra',  w: 16 },
        { tier: 'secret', w: 6 },
      ],
    },
    theme: {
      '--accent': '#39ff14', '--accent-glow': 'rgba(57,255,20,0.45)',
      '--pack-c1': '#39ff14', '--pack-c2': '#00f0ff', '--pack-c3': '#ffd700', '--pack-c4': '#b829ff',
    },
  },
  {
    id: 'obsidian',
    apiSetId: 'sv3',
    name: 'Obsidian Flames',
    blurb: 'Terastal Charizard & Dragonite. Dark-fire chase cards.',
    cost: 6, // fallback; actual price = average pack value, computed from live data
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 48 },
        { tier: 'holo',   w: 32 },
        { tier: 'ultra',  w: 15 },
        { tier: 'secret', w: 5 },
      ],
    },
    theme: {
      '--accent': '#ff6b35', '--accent-glow': 'rgba(255,107,53,0.5)',
      '--pack-c1': '#ff6b35', '--pack-c2': '#212121', '--pack-c3': '#ff2e9a', '--pack-c4': '#d84315',
    },
  },
  {
    id: 'crownzenith',
    apiSetId: 'swsh12pt5',
    name: 'Crown Zenith',
    blurb: 'Galarian Gallery era. Stacked pull rates, big hits.',
    cost: 6, // fallback; actual price = average pack value, computed from live data
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 44 },
        { tier: 'holo',   w: 34 },
        { tier: 'ultra',  w: 17 },
        { tier: 'secret', w: 5 },
      ],
    },
    theme: {
      '--accent': '#ffd700', '--accent-glow': 'rgba(255,215,0,0.45)',
      '--pack-c1': '#ffd700', '--pack-c2': '#00f0ff', '--pack-c3': '#b829ff', '--pack-c4': '#39ff14',
    },
  },
  {
    id: 'base',
    apiSetId: 'base1',
    name: 'Base Set',
    blurb: 'Vintage 1999. The original — chase the holo Charizard.',
    cost: 46, // fallback; actual price = average pack value, computed from live data
    cooldownMs: 0,
    pack: {
      // vintage: no reverse-holo slot; 7 commons/uncommons + 1 rare slot.
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare-slot'],
      // Base Set only has rare + rare-holo as hits.
      rareSlot: [
        { tier: 'rare', w: 72 },
        { tier: 'holo', w: 28 },
      ],
    },
    theme: {
      '--accent': '#ff7043', '--accent-glow': 'rgba(255,112,67,0.5)',
      '--pack-c1': '#1565c0', '--pack-c2': '#ff7043', '--pack-c3': '#ffd700', '--pack-c4': '#1565c0',
    },
  },
  {
    id: 'fossil',
    apiSetId: 'base3',
    name: 'Fossil',
    blurb: 'Vintage 1999. Premium. Holo Articuno / Aerodactyl / Lapras chase.',
    cost: 65,
    cooldownMs: 0,
    pack: {
      // vintage packs had no reverse-holo slot; 7 commons/uncommons + 1 rare slot.
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare-slot'],
      // Fossil only has rare + rare-holo as hits (no ultra/secret tiers exist).
      rareSlot: [
        { tier: 'rare', w: 72 },
        { tier: 'holo', w: 28 },
      ],
    },
    theme: {
      '--accent': '#e0a93f', '--accent-glow': 'rgba(224,169,63,0.5)',
      '--pack-c1': '#d9b061', '--pack-c2': '#8a6d4b', '--pack-c3': '#3fb6a8', '--pack-c4': '#d9b061',
    },
  },
];

export function getSet(id) {
  return SETS.find(s => s.id === id) || SETS[0];
}

export const FREE_SET_ID = 'prismatic';

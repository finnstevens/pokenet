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
    cost: 0,             // free (cooldown-gated)
    sealedPrice: 12,     // real sealed single-pack market price
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
    cost: 12, sealedPrice: 12, // real sealed single-pack market price
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
    cost: 5, sealedPrice: 5, // real sealed single-pack market price
    box: { packs: 36, price: 150 }, // real sealed booster-box market price
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
    cost: 6, sealedPrice: 6, // real sealed single-pack market price
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
    cost: 15, sealedPrice: 15, // real sealed single-pack market price
    box: { packs: 36, price: 520 }, // real sealed booster-box market price
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
    cost: 5, sealedPrice: 5, // real sealed single-pack market price
    box: { packs: 36, price: 140 }, // real sealed booster-box market price
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
    cost: 10, sealedPrice: 10, // real sealed single-pack market price
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
    id: 'ascended',
    apiSetId: 'me2pt5',
    name: 'Ascended Heroes',
    blurb: 'Mega Evolution era. Mega Dragonite ex & all-star Megas.',
    cost: 5, sealedPrice: 5, // real sealed single-pack market price
    cooldownMs: 0,
    pack: {
      // NOTE: this set's card data is preliminary (no live prices yet, no
      // secret/SIR rarities catalogued) — odds use the tiers that exist.
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 50 },
        { tier: 'holo',   w: 35 },
        { tier: 'ultra',  w: 15 },
      ],
    },
    theme: {
      '--accent': '#ff2e9a', '--accent-glow': 'rgba(255,46,154,0.45)',
      '--pack-c1': '#ff2e9a', '--pack-c2': '#39ff14', '--pack-c3': '#ffd700', '--pack-c4': '#00f0ff',
    },
  },
  {
    id: 'exdragon',
    apiSetId: 'ex3',
    name: 'EX Dragon',
    blurb: 'Vintage 2003. Rayquaza-led dragons; ex & secret-rare chase.',
    cost: 50, sealedPrice: 50, // real sealed single-pack market price
    box: { packs: 36, price: 2400 }, // real sealed booster-box market price (approx, vintage)
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      rareSlot: [
        { tier: 'rare',   w: 54 },
        { tier: 'holo',   w: 28 },
        { tier: 'ultra',  w: 14 },
        { tier: 'secret', w: 4 },
      ],
    },
    theme: {
      '--accent': '#ff9800', '--accent-glow': 'rgba(255,152,0,0.5)',
      '--pack-c1': '#ff9800', '--pack-c2': '#43a047', '--pack-c3': '#ffd700', '--pack-c4': '#e65100',
    },
  },
  {
    id: 'base',
    apiSetId: 'base1',
    name: 'Base Set',
    blurb: 'Vintage 1999. The original — chase the holo Charizard.',
    cost: 350, sealedPrice: 350, // real sealed (Unlimited) single-pack market price
    box: { packs: 36, price: 9500 }, // real sealed (Unlimited) booster-box market price (approx)
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
    cost: 110, sealedPrice: 110, // real sealed (Unlimited) single-pack market price
    box: { packs: 36, price: 3200 }, // real sealed (Unlimited) booster-box market price (approx)
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
  {
    id: 'blackwhite',
    apiSetId: 'bw1',
    name: 'Black & White',
    blurb: 'Vintage 2011. Reshiram & Zekrom — the first-ever Full Art ultras.',
    cost: 22, sealedPrice: 22, // real sealed single-pack market price
    box: { packs: 36, price: 520 }, // real sealed booster-box market price (approx)
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      // bw1 hits: Rare Holo, Rare Ultra (Full Arts), and one Rare Secret.
      rareSlot: [
        { tier: 'rare',   w: 52 },
        { tier: 'holo',   w: 30 },
        { tier: 'ultra',  w: 13 },
        { tier: 'secret', w: 5 },
      ],
    },
    theme: {
      '--accent': '#cfe3ff', '--accent-glow': 'rgba(120,180,255,0.45)',
      '--pack-c1': '#f5f5f5', '--pack-c2': '#1a1a1a', '--pack-c3': '#4f9bff', '--pack-c4': '#f5f5f5',
    },
  },
  {
    id: 'hiddenfates',
    apiSetId: 'sm115',
    name: 'Hidden Fates',
    blurb: 'SM 2019. Shiny-soaked GX chase. (Base set — Shiny Vault not included.)',
    cost: 35, sealedPrice: 35, // real sealed single-pack market price (popular set)
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      // hits: Rare, Rare Holo, Rare Holo GX (ultra), Rare Rainbow (secret).
      rareSlot: [
        { tier: 'rare',   w: 50 },
        { tier: 'holo',   w: 30 },
        { tier: 'ultra',  w: 15 },
        { tier: 'secret', w: 5 },
      ],
    },
    theme: {
      '--accent': '#9fe8e0', '--accent-glow': 'rgba(120,230,220,0.45)',
      '--pack-c1': '#cfd8e8', '--pack-c2': '#7b2ff7', '--pack-c3': '#00f0ff', '--pack-c4': '#cfd8e8',
    },
  },
  {
    id: 'championspath',
    apiSetId: 'swsh35',
    name: "Champion's Path",
    blurb: 'SWSH 2020. Premium. Charizard VMAX & the rainbow secret chase.',
    cost: 28, sealedPrice: 28, // real sealed single-pack market price
    cooldownMs: 0,
    pack: {
      // No plain-rare tier in this set — every hit is Rare Holo or better.
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      // hits: Rare Holo / Rare Holo V (holo), VMAX + Rare Ultra (ultra), Rainbow + Secret (secret).
      rareSlot: [
        { tier: 'holo',   w: 60 },
        { tier: 'ultra',  w: 30 },
        { tier: 'secret', w: 10 },
      ],
    },
    theme: {
      '--accent': '#ffd24a', '--accent-glow': 'rgba(255,210,74,0.45)',
      '--pack-c1': '#b06fd6', '--pack-c2': '#ffd24a', '--pack-c3': '#ff7ad9', '--pack-c4': '#b06fd6',
    },
  },
  {
    id: 'unifiedminds',
    apiSetId: 'sm11',
    name: 'Unified Minds',
    blurb: 'SM 2019. Huge 260-card set. Mewtwo & Mew GX, Rainbow rares.',
    cost: 10, sealedPrice: 10, // real sealed single-pack market price
    box: { packs: 36, price: 300 }, // real sealed booster-box market price (approx)
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      // hits: Rare, Rare Holo, Rare Holo GX + Rare Ultra (ultra), Rare Rainbow (secret).
      rareSlot: [
        { tier: 'rare',   w: 50 },
        { tier: 'holo',   w: 30 },
        { tier: 'ultra',  w: 15 },
        { tier: 'secret', w: 5 },
      ],
    },
    theme: {
      '--accent': '#5cc8ff', '--accent-glow': 'rgba(92,200,255,0.45)',
      '--pack-c1': '#3b2a6b', '--pack-c2': '#ff5db1', '--pack-c3': '#5cc8ff', '--pack-c4': '#1a1030',
    },
  },
  {
    id: 'generations',
    apiSetId: 'g1',
    name: 'Generations',
    blurb: 'XY 2016. 20th-anniversary set. Radiant Collection & Rare Holo EX hits.',
    cost: 18, sealedPrice: 18, // real sealed single-pack market price (anniversary set)
    cooldownMs: 0,
    pack: {
      slots: ['common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'reverse', 'rare-slot'],
      // hits: Rare, Rare Holo, Rare Holo EX + Rare Ultra (ultra). No secret tier in g1.
      rareSlot: [
        { tier: 'rare',  w: 52 },
        { tier: 'holo',  w: 30 },
        { tier: 'ultra', w: 18 },
      ],
    },
    theme: {
      '--accent': '#ffd11a', '--accent-glow': 'rgba(255,209,26,0.45)',
      '--pack-c1': '#ff5a3c', '--pack-c2': '#ffd11a', '--pack-c3': '#ffffff', '--pack-c4': '#ff5a3c',
    },
  },
];

export function getSet(id) {
  return SETS.find(s => s.id === id) || SETS[0];
}

export const FREE_SET_ID = 'prismatic';

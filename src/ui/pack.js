/* The headline experience: pick a set, rip the pack, reveal real cards.
   Loads the selected set's real card list (cached after first fetch), gates the
   free Prismatic Evolutions pack behind a live 60s cooldown, charges money for
   paid packs, and reveals the real card images with a rarity-scaled celebration. */

import { SETS, getSet } from '../data/sets.js';
import { generatePack, bestRarity } from '../game/packs.js';
import { state, addCards, addPacks, spendMoney, setSelectedSet, markOpened, addSealed, consumeSealed,
         addBox, consumeBoxPack, takeBox, addSealedMany, boxPacksRemaining } from '../state/store.js';
import { cooldownRemaining, formatCooldown } from '../game/economy.js';
import { loadSet, loadedSet } from '../services/cards.js';
import { cardInnerHTML } from './card.js';
import { renderStats } from './stats.js';
import { celebrate } from './fx.js';
import { toast } from './toast.js';
import * as sfx from '../services/audio.js';

let $pack, $hint, $reveal, $actions, $picker, $logo, $fallback, $tiny, $btnNew, $btnFlip, $packArt;
let $btnBuyBox, $boxControls, $boxNext, $boxSkip, $boxDone, $boxHead;
let revealing = false; // true while cards are shown (pack hidden)
let pendingAchievements = []; // held until the player flips the cards, so toasts don't spoil the pull
let boxSession = null; // { set, packs:[[card]], idx, total } while ripping a box pack-by-pack

export function initPack() {
  $pack    = document.getElementById('pack');
  $hint    = document.getElementById('hint');
  $reveal  = document.getElementById('reveal');
  $actions = document.getElementById('actions');
  $picker  = document.getElementById('pack-picker');
  $logo     = document.getElementById('pack-logo');
  $packArt  = document.getElementById('pack-art');
  $fallback = document.getElementById('pack-fallback');
  $tiny     = document.getElementById('pack-tiny');
  $btnNew  = document.getElementById('btn-new');
  $btnFlip = document.getElementById('btn-flip-all');
  $btnBuyBox   = document.getElementById('btn-buy-box');
  $boxControls = document.getElementById('box-controls');
  $boxNext     = document.getElementById('btn-box-next');
  $boxSkip     = document.getElementById('btn-box-skip');
  $boxDone     = document.getElementById('btn-box-done');
  $boxHead     = document.getElementById('box-rip-head');

  $pack.addEventListener('click', openPack);
  document.getElementById('btn-keep-sealed').addEventListener('click', keepSealed);
  $btnBuyBox.addEventListener('click', buyBox);
  $boxNext.addEventListener('click', () => { sfx.playClick(); advanceBoxSession(); });
  $boxSkip.addEventListener('click', () => { sfx.playClick(); showBoxResults(); });
  $boxDone.addEventListener('click', () => { sfx.playClick(); endBoxSession(); });
  $btnNew.addEventListener('click', () => { sfx.playClick(); resetForNewPack(); });
  $btnFlip.addEventListener('click', () => {
    $reveal.querySelectorAll('.card:not(.flipped)').forEach(c => {
      c.classList.add('flipped');
      sfx.playFlip();
    });
    maybeFlushAchievements();
  });

  $picker.addEventListener('click', e => {
    const opt = e.target.closest('.pack-option');
    if (!opt || revealing) return;
    sfx.playClick();
    setSelectedSet(opt.dataset.set);
    selectSet(getSet(opt.dataset.set));
  });

  selectSet(getSet(state.selectedSet));

  // Pre-warm every set so the picker shows real averaged prices (not the static
  // fallback) and updates as each loads. Cached after the first fetch. Loaded with
  // limited concurrency (not all at once) so the keyless public API doesn't rate-
  // limit the burst and drop sets — loadSet retries with backoff as a backstop.
  prewarmSets();

  // Live ticker for the free-pack cooldown countdown.
  setInterval(updatePackState, 500);
}

/* Pre-warm all sets with a small concurrency cap so we don't fire ~18 requests
   at once (which the keyless public API rate-limits). Each finished load starts
   the next; the picker re-renders as sets arrive. */
function prewarmSets() {
  const queue = SETS.filter(s => !loadedSet(s.apiSetId));
  const CONCURRENCY = 4;
  let active = 0;
  const pump = () => {
    while (active < CONCURRENCY && queue.length) {
      const s = queue.shift();
      active++;
      loadSet(s.apiSetId)
        .then(() => renderPicker())
        .catch(() => {})
        .finally(() => { active--; pump(); });
    }
  };
  pump();
}

/* The price of a pack is its real sealed-pack market price (set in
   data/sets.js). The free pack stays free. */
function costOf(set) {
  return set.cost;
}

function setTinyLabel(set) {
  $tiny.textContent = set.cost === 0
    ? `FREE · 1 PER ${formatCooldown(set.cooldownMs)}`
    : `$${costOf(set)}`;
}

/* Apply a set's theme + labels and ensure its cards are loaded. */
function selectSet(set) {
  // Real booster-pack wrapper art if we have it (assets/packs/<id>.png): it
  // becomes the whole pack face and our logo is hidden (the wrapper has its own).
  // If the file is missing, fall back to the holo gradient + set logo.
  $pack.classList.remove('has-art');
  $packArt.classList.remove('img-fail');
  $packArt.onload = () => $pack.classList.add('has-art');
  $packArt.onerror = () => { $packArt.classList.add('img-fail'); $pack.classList.remove('has-art'); };
  $packArt.src = `./assets/packs/${set.id}.png`;

  // Fallback artwork: the official set logo from pokemontcg.io (set name as text
  // if even that fails).
  $logo.classList.remove('img-fail');
  $logo.src = `https://images.pokemontcg.io/${set.apiSetId}/logo.png`;
  $logo.alt = set.name;
  $fallback.textContent = set.name;
  setTinyLabel(set);
  updateBuyBoxBtn(set);
  Object.entries(set.theme).forEach(([k, v]) => $pack.style.setProperty(k, v));
  renderPicker();
  updatePackState();

  if (!loadedSet(set.apiSetId)) {
    loadSet(set.apiSetId)
      .then(() => { setTinyLabel(set); renderPicker(); updatePackState(); })
      .catch(() => { updatePackState(); });
  }
}

export function renderPicker() {
  if (!$picker) return;
  $picker.innerHTML = SETS.map(set => {
    const ready = !!loadedSet(set.apiSetId);
    const cost = costOf(set);
    const afford = cost === 0 || state.money >= cost;
    const costLabel = cost === 0 ? 'FREE' : `$${cost}`;
    return `
      <div class="pack-option ${set.id === state.selectedSet ? 'selected' : ''}"
           data-set="${set.id}"
           style="--accent:${set.theme['--accent']};--accent-glow:${set.theme['--accent-glow']}">
        <div class="name">${set.name}</div>
        <div class="blurb">${set.blurb}</div>
        <div class="cost ${set.cost === 0 ? 'free' : (afford ? '' : 'cant-afford')}">${costLabel}</div>
        ${ready ? '' : `<div class="set-loading">loading…</div>`}
      </div>
    `;
  }).join('');
}

/* Free-pack cooldown remaining in ms for the current set (0 if none). */
function currentCooldown(set) {
  if (!set.cooldownMs) return 0;
  return cooldownRemaining(state.lastOpen[set.id], set.cooldownMs, Date.now());
}

/* Reflect loading / cooldown / affordability onto the pack + hint. */
function updatePackState() {
  if (!$pack || revealing) return;
  const set = getSet(state.selectedSet);
  const loaded = !!loadedSet(set.apiSetId);

  if (!loaded) {
    $pack.classList.add('disabled');
    $hint.textContent = 'LOADING SET…';
    return;
  }

  const cd = currentCooldown(set);
  if (cd > 0) {
    $pack.classList.add('disabled');
    $hint.textContent = `NEXT FREE PACK IN ${formatCooldown(cd)}`;
    return;
  }

  const cost = costOf(set);
  if (cost > 0 && state.money < cost) {
    $pack.classList.add('disabled');
    $hint.textContent = `NEED $${cost} — SELL CARDS OR CLAIM DAILY`;
    return;
  }

  $pack.classList.remove('disabled');
  $hint.textContent = cost === 0 ? '▼ CLICK TO OPEN — FREE ▼' : `▼ CLICK TO OPEN — $${cost} ▼`;
}

function openPack() {
  if (revealing || $pack.classList.contains('opening') || $pack.classList.contains('torn')) return;

  const set = getSet(state.selectedSet);
  const cards = loadedSet(set.apiSetId);
  if (!cards) { toast('Loading set', 'Card data is still loading — try again in a moment.'); return; }

  if (currentCooldown(set) > 0) return; // gated; countdown shown in hint

  const cost = costOf(set);
  if (cost > 0) {
    if (state.money < cost) {
      toast('Not enough money', `${set.name} costs $${cost}. Sell cards or claim your daily reward.`);
      return;
    }
    spendMoney(cost);
  }
  if (set.cooldownMs) markOpened(set.id, Date.now());

  doReveal(set, cards);
}

/* The rip + reveal animation (no cost/gating — callers handle that, including
   opening a pack you already hold sealed). */
function doReveal(set, cards) {
  revealing = true;
  document.getElementById('btn-keep-sealed').style.display = 'none';
  $btnBuyBox.style.display = 'none';
  $pack.classList.add('opening');
  sfx.playShake();

  setTimeout(() => {
    $pack.classList.remove('opening');
    $pack.classList.add('torn');
    sfx.playTear();

    const pack = generatePack(set, cards);
    const unlocked = addCards(pack);

    setTimeout(() => {
      $pack.style.display = 'none';
      renderPack(pack);
      $actions.style.display = 'flex';

      const best = bestRarity(pack);
      sfx.playFanfare(best);
      celebrate(best);
      pendingAchievements = unlocked; // hold toasts until the cards are flipped
    }, 600);
  }, 1500);
}

/* Buy the selected pack but KEEP it sealed (don't open) — same cost/cooldown
   gating as opening; adds one to the sealed collection. */
function keepSealed() {
  if (revealing) return;
  const set = getSet(state.selectedSet);
  if (currentCooldown(set) > 0) return;
  const cost = costOf(set);
  if (cost > 0) {
    if (state.money < cost) {
      toast('Not enough money', `${set.name} costs $${cost} to keep sealed.`);
      return;
    }
    spendMoney(cost);
  }
  if (set.cooldownMs) markOpened(set.id, Date.now());
  addSealed(set.id);
  sfx.playClick();
  toast('Kept sealed', `${set.name} added to your sealed collection (Binder ▸ Sealed).`);
}

/* Open a pack the player already holds sealed: consume it, jump to the Open
   tab, and reveal — no further cost. */
export function openFromSealed(setId) {
  if (revealing) return;
  const set = getSet(setId);
  if ((state.sealed[set.id] || 0) < 1) return;
  consumeSealed(set.id);
  document.querySelector('#tabs [data-tab="shop"]').click();
  document.querySelector('#shop-subtabs [data-sub="buy"]').click();
  setSelectedSet(set.id);
  selectSet(set);
  const cards = loadedSet(set.apiSetId);
  if (cards) doReveal(set, cards);
  else loadSet(set.apiSetId).then(c => doReveal(set, c)).catch(() => toast('Load failed', 'Could not load that set right now.'));
}

/* ---- booster boxes ---- */

/* Show/label the Buy Box button only for sets that have a real booster box. */
function updateBuyBoxBtn(set) {
  if (!$btnBuyBox) return;
  if (set.box) {
    $btnBuyBox.style.display = '';
    $btnBuyBox.textContent = `Buy Box — $${set.box.price} · ${set.box.packs} packs`;
  } else {
    $btnBuyBox.style.display = 'none';
  }
}

/* Buy a sealed booster box for the selected set: charge the box price and bank
   it (unopened) in the Binder ▸ Sealed boxes — never opens on purchase. */
function buyBox() {
  if (revealing) return;
  const set = getSet(state.selectedSet);
  if (!set.box) return;
  const price = set.box.price;
  if (state.money < price) {
    toast('Not enough money', `A ${set.name} box costs $${price}. Sell cards or claim your daily reward.`);
    return;
  }
  spendMoney(price);
  addBox(set.id, set.box.packs);
  sfx.playClick();
  toast('Box added', `${set.name} booster box (${set.box.packs} packs) added to Binder ▸ Sealed.`);
}

/* Open ONE pack from a held box: consume a pack from the most-opened box, jump
   to the Buy tab, and reveal it with the normal single-pack flow. */
export function openPackFromBox(setId) {
  if (revealing) return;
  const set = getSet(setId);
  if (boxPacksRemaining(set.id) < 1) return;
  consumeBoxPack(set.id);
  document.querySelector('#tabs [data-tab="shop"]').click();
  document.querySelector('#shop-subtabs [data-sub="buy"]').click();
  setSelectedSet(set.id);
  selectSet(set);
  const cards = loadedSet(set.apiSetId);
  if (cards) doReveal(set, cards);
  else loadSet(set.apiSetId).then(c => doReveal(set, c)).catch(() => toast('Load failed', 'Could not load that set right now.'));
}

/* Rip a whole box: remove one box, generate + bank ALL its packs at once (so
   nothing is lost if interrupted), then present them pack-by-pack with a
   skip-to-results option. */
export function ripBox(setId) {
  if (revealing) return;
  const set = getSet(setId);
  const cards = loadedSet(set.apiSetId);
  if (!cards) {
    loadSet(set.apiSetId).then(() => ripBox(setId)).catch(() => toast('Load failed', 'Could not load that set right now.'));
    return;
  }
  const n = takeBox(set.id);
  if (!n) return;

  document.querySelector('#tabs [data-tab="shop"]').click();
  document.querySelector('#shop-subtabs [data-sub="buy"]').click();
  setSelectedSet(set.id);
  selectSet(set);

  const packs = Array.from({ length: n }, () => generatePack(set, cards));
  pendingAchievements = addPacks(packs); // bank everything up front, one commit
  startBoxSession(set, packs, `${set.name} Box`);
}

/* Open several sealed packs at once (e.g. "Open 5"): consume up to n of the held
   sealed packs for a set, bank them all, and present them with the same
   pack-by-pack-with-skip flow as ripping a box. */
export function openManyFromSealed(setId, n) {
  if (revealing) return;
  const set = getSet(setId);
  const have = state.sealed[set.id] || 0;
  const count = Math.min(n, have);
  if (count < 1) return;
  const cards = loadedSet(set.apiSetId);
  if (!cards) {
    loadSet(set.apiSetId).then(() => openManyFromSealed(setId, n)).catch(() => toast('Load failed', 'Could not load that set right now.'));
    return;
  }
  for (let i = 0; i < count; i++) consumeSealed(set.id);
  document.querySelector('#tabs [data-tab="shop"]').click();
  document.querySelector('#shop-subtabs [data-sub="buy"]').click();
  setSelectedSet(set.id);
  selectSet(set);

  const packs = Array.from({ length: count }, () => generatePack(set, cards));
  pendingAchievements = addPacks(packs);
  startBoxSession(set, packs, `${set.name} ×${count}`);
}

/* Enter the pack-by-pack rip presentation for an already-banked set of packs. */
function startBoxSession(set, packs, label) {
  revealing = true;
  boxSession = { set, packs, idx: 0, total: packs.length, label: label || `${set.name} Box` };
  document.getElementById('btn-keep-sealed').style.display = 'none';
  $btnBuyBox.style.display = 'none';
  $pack.style.display = 'none';
  $actions.style.display = 'none';
  $boxControls.style.display = 'flex';
  $boxDone.style.display = 'none';
  $boxNext.style.display = '';
  $boxSkip.style.display = '';
  showBoxPack(0);
}

/* Reveal a single pack within the rip session (cards shown face-up for speed). */
function showBoxPack(i) {
  boxSession.idx = i;
  const pack = boxSession.packs[i];
  renderBoxCards(pack);
  const best = bestRarity(pack);
  sfx.playFanfare(best);
  celebrate(best);
  const last = i >= boxSession.total - 1;
  $boxHead.style.display = '';
  $boxHead.textContent = `${boxSession.label} · Pack ${i + 1} / ${boxSession.total}`;
  $boxNext.textContent = last ? 'See Results ▶' : 'Open Next Pack ▶';
}

function advanceBoxSession() {
  if (!boxSession) return;
  if (boxSession.idx >= boxSession.total - 1) { showBoxResults(); return; }
  showBoxPack(boxSession.idx + 1);
}

/* Skip / finish: show every card pulled from the box in one grid. */
function showBoxResults() {
  if (!boxSession) return;
  const all = boxSession.packs.flat();
  renderBoxCards(all);
  const best = bestRarity(all);
  sfx.playFanfare(best);
  celebrate(best);
  $boxHead.style.display = '';
  $boxHead.textContent = `${boxSession.label} · ${boxSession.total} packs · ${all.length} cards`;
  $boxNext.style.display = 'none';
  $boxSkip.style.display = 'none';
  $boxDone.style.display = '';
  pendingAchievements.forEach(a => toast('Achievement: ' + a.title, a.desc));
  pendingAchievements = [];
}

function endBoxSession() {
  boxSession = null;
  revealing = false;
  pendingAchievements = [];
  $boxControls.style.display = 'none';
  $boxHead.style.display = 'none';
  $reveal.classList.remove('show');
  $reveal.innerHTML = '';
  $pack.style.display = '';
  document.getElementById('btn-keep-sealed').style.display = '';
  updateBuyBoxBtn(getSet(state.selectedSet));
  updatePackState();
}

/* Render a list of cards face-up in the reveal grid (used by the rip session). */
function renderBoxCards(cards) {
  $reveal.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card flipped';
    el.dataset.rarity = card.tier;
    el.innerHTML = cardInnerHTML(card);
    $reveal.appendChild(el);
  });
  $reveal.classList.add('show');
  renderStats();
}

function renderPack(pack) {
  $reveal.innerHTML = '';
  pack.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.rarity = card.tier; // CSS rarity colours are keyed on our tier names
    el.innerHTML = cardInnerHTML(card);
    el.addEventListener('click', () => {
      if (!el.classList.contains('flipped')) {
        el.classList.add('flipped');
        sfx.playFlip();
        maybeFlushAchievements();
      }
    });
    $reveal.appendChild(el);
  });
  $reveal.classList.add('show');
  renderStats();
}

/* Show held achievement toasts only once every card is flipped, so they don't
   reveal a big pull before the player turns the cards over. */
function maybeFlushAchievements() {
  if (!pendingAchievements.length) return;
  const cards = $reveal.querySelectorAll('.card');
  const allFlipped = cards.length > 0 && [...cards].every(c => c.classList.contains('flipped'));
  if (!allFlipped) return;
  pendingAchievements.forEach(a => toast('Achievement: ' + a.title, a.desc));
  pendingAchievements = [];
}

function resetForNewPack() {
  revealing = false;
  pendingAchievements = []; // achievement is already saved; drop any unshown toast
  $reveal.classList.remove('show');
  $reveal.innerHTML = '';
  $actions.style.display = 'none';
  $pack.style.display = '';
  $pack.classList.remove('torn', 'opening');
  document.getElementById('btn-keep-sealed').style.display = '';
  updateBuyBoxBtn(getSet(state.selectedSet));
  updatePackState();
}

/* The headline experience: pick a set, rip the pack, reveal real cards.
   Loads the selected set's real card list (cached after first fetch), gates the
   free Prismatic Evolutions pack behind a live 60s cooldown, charges money for
   paid packs, and reveals the real card images with a rarity-scaled celebration. */

import { SETS, getSet } from '../data/sets.js';
import { generatePack, bestRarity, packAverageValue } from '../game/packs.js';
import { state, addCards, spendMoney, setSelectedSet, markOpened, addSealed, consumeSealed } from '../state/store.js';
import { cooldownRemaining, formatCooldown } from '../game/economy.js';
import { loadSet, loadedSet } from '../services/cards.js';
import { cardInnerHTML } from './card.js';
import { renderStats } from './stats.js';
import { celebrate } from './fx.js';
import { toast } from './toast.js';
import * as sfx from '../services/audio.js';

let $pack, $hint, $reveal, $actions, $picker, $logo, $fallback, $tiny, $btnNew, $btnFlip, $packArt;
let revealing = false; // true while cards are shown (pack hidden)
let pendingAchievements = []; // held until the player flips the cards, so toasts don't spoil the pull

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

  $pack.addEventListener('click', openPack);
  document.getElementById('btn-keep-sealed').addEventListener('click', keepSealed);
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
  // fallback) and updates as each loads. Cached after the first fetch.
  SETS.forEach(s => {
    if (!loadedSet(s.apiSetId)) loadSet(s.apiSetId).then(() => renderPicker()).catch(() => {});
  });

  // Live ticker for the free-pack cooldown countdown.
  setInterval(updatePackState, 500);
}

/* The price of a paid pack = its average value (rounded), computed from the
   loaded set. Free pack stays free; falls back to the static cost until the
   set's cards are loaded. */
function costOf(set) {
  if (set.cost === 0) return 0;
  const cards = loadedSet(set.apiSetId);
  if (!cards) return set.cost;
  return Math.max(1, Math.round(packAverageValue(set, cards)));
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
  updatePackState();
}

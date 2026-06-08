/* The headline experience: pick a set, rip the pack, reveal real cards.
   Loads the selected set's real card list (cached after first fetch), gates the
   free Prismatic Evolutions pack behind a live 60s cooldown, charges money for
   paid packs, and reveals the real card images with a rarity-scaled celebration. */

import { SETS, getSet } from '../data/sets.js';
import { generatePack, bestRarity } from '../game/packs.js';
import { state, addCards, spendMoney, setSelectedSet, markOpened } from '../state/store.js';
import { canAfford, cooldownRemaining, formatCooldown } from '../game/economy.js';
import { loadSet, loadedSet } from '../services/cards.js';
import { cardInnerHTML } from './card.js';
import { renderStats } from './stats.js';
import { celebrate } from './fx.js';
import { toast } from './toast.js';
import * as sfx from '../services/audio.js';

let $pack, $hint, $reveal, $actions, $picker, $logo, $fallback, $tiny, $btnNew, $btnFlip;
let revealing = false; // true while cards are shown (pack hidden)
let pendingAchievements = []; // held until the player flips the cards, so toasts don't spoil the pull

export function initPack() {
  $pack    = document.getElementById('pack');
  $hint    = document.getElementById('hint');
  $reveal  = document.getElementById('reveal');
  $actions = document.getElementById('actions');
  $picker  = document.getElementById('pack-picker');
  $logo     = document.getElementById('pack-logo');
  $fallback = document.getElementById('pack-fallback');
  $tiny     = document.getElementById('pack-tiny');
  $btnNew  = document.getElementById('btn-new');
  $btnFlip = document.getElementById('btn-flip-all');

  $pack.addEventListener('click', openPack);
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

  // Live ticker for the free-pack cooldown countdown.
  setInterval(updatePackState, 500);
}

/* Apply a set's theme + labels and ensure its cards are loaded. */
function selectSet(set) {
  // Real set artwork: the official logo from pokemontcg.io. Falls back to the
  // set name as text if the image can't load.
  $logo.classList.remove('img-fail');
  $logo.src = `https://images.pokemontcg.io/${set.apiSetId}/logo.png`;
  $logo.alt = set.name;
  $fallback.textContent = set.name;
  $tiny.textContent = set.cost === 0 ? `FREE · 1 PER ${formatCooldown(set.cooldownMs)}` : `$${set.cost}`;
  Object.entries(set.theme).forEach(([k, v]) => $pack.style.setProperty(k, v));
  renderPicker();
  updatePackState();

  if (!loadedSet(set.apiSetId)) {
    loadSet(set.apiSetId)
      .then(() => { renderPicker(); updatePackState(); })
      .catch(() => { updatePackState(); });
  }
}

export function renderPicker() {
  if (!$picker) return;
  $picker.innerHTML = SETS.map(set => {
    const ready = !!loadedSet(set.apiSetId);
    const afford = canAfford(state.money, set);
    const costLabel = set.cost === 0 ? 'FREE' : `$${set.cost}`;
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

  if (set.cost > 0 && !canAfford(state.money, set)) {
    $pack.classList.add('disabled');
    $hint.textContent = `NEED $${set.cost} — SELL CARDS OR CLAIM DAILY`;
    return;
  }

  $pack.classList.remove('disabled');
  $hint.textContent = set.cost === 0 ? '▼ CLICK TO OPEN — FREE ▼' : `▼ CLICK TO OPEN — $${set.cost} ▼`;
}

function openPack() {
  if (revealing || $pack.classList.contains('opening') || $pack.classList.contains('torn')) return;

  const set = getSet(state.selectedSet);
  const cards = loadedSet(set.apiSetId);
  if (!cards) { toast('Loading set', 'Card data is still loading — try again in a moment.'); return; }

  if (currentCooldown(set) > 0) return; // gated; countdown shown in hint

  if (set.cost > 0) {
    if (!canAfford(state.money, set)) {
      toast('Not enough money', `${set.name} costs $${set.cost}. Sell cards or claim your daily reward.`);
      return;
    }
    spendMoney(set.cost);
  }
  if (set.cooldownMs) markOpened(set.id, Date.now());

  revealing = true;
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
  updatePackState();
}

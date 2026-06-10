/* The Events tab. First event: the Card Show — attend once an hour to buy a
   one-time lineup of real single cards (market + deals), packs, and a box, at a
   show discount. Stock generation is in game/cardshow.js; the lineup persists in
   state so you can keep buying until the next show. */

import { state, enterCardShow, buyShowItem } from '../state/store.js';
import { SETS } from '../data/sets.js';
import { loadedSet } from '../services/cards.js';
import { generateStock } from '../game/cardshow.js';
import { cardShowCooldownRemaining, formatCooldown } from '../game/economy.js';
import { formatPrice } from '../services/prices.js';
import { playClick, playCoin } from '../services/audio.js';
import { toast } from './toast.js';

let headEl, stockEl;

export function initEvents() {
  headEl = document.getElementById('cardshow-head');
  stockEl = document.getElementById('cardshow-stock');

  headEl.addEventListener('click', e => {
    if (e.target.closest('#cardshow-enter')) enterShow();
  });
  stockEl.addEventListener('click', e => {
    const btn = e.target.closest('.show-buy');
    if (!btn || btn.disabled) return;
    const res = buyShowItem(btn.dataset.item, Date.now());
    if (!res) return;
    if (res.error === 'money') { toast('Not enough money', 'You can\'t afford that yet.'); return; }
    playCoin();
    const it = res.item;
    const what = it.kind === 'single' ? it.card.name : it.kind === 'box' ? `${it.setName} box` : `${it.setName} pack`;
    toast('Bought', `${what} → ${formatPrice(it.price)}${it.kind === 'single' ? ' (in your binder)' : it.kind === 'box' ? ' (Binder ▸ Sealed)' : ' (Binder ▸ Sealed)'}`);
    renderEvents();
  });

  // Live countdown while idling on the Events tab.
  setInterval(() => {
    if (document.getElementById('view-events').classList.contains('active')) renderEvents();
  }, 500);
}

function deckPool() {
  return SETS.flatMap(s => loadedSet(s.apiSetId) || []);
}

function enterShow() {
  if (cardShowCooldownRemaining(state.lastCardShow, Date.now()) > 0) return;
  const pool = deckPool();
  if (!pool.length) { toast('Setting up…', 'The card show is still unpacking — try again in a moment.'); return; }
  playClick();
  enterCardShow(generateStock(pool, SETS, Date.now()), Date.now());
  toast('Welcome to the Card Show!', 'Grab some deals — singles, packs, and a box.');
  renderEvents();
}

export function renderEvents() {
  if (!headEl) return;
  const remaining = cardShowCooldownRemaining(state.lastCardShow, Date.now());
  const stock = state.cardShowStock;

  if (remaining > 0) {
    headEl.innerHTML = `
      <div class="cardshow-title">🎪 Card Show</div>
      <div class="cardshow-sub">Next show in <strong style="color:var(--neon-yellow)">${formatCooldown(remaining)}</strong>${stock ? ' · browse this show\'s remaining stock below' : ''}</div>`;
  } else {
    headEl.innerHTML = `
      <div class="cardshow-title">🎪 Card Show is in town!</div>
      <div class="cardshow-sub">A fresh lineup of singles, packs &amp; a box — most at market, with a couple of deals.</div>
      <button class="btn primary" id="cardshow-enter">Enter the Card Show</button>`;
  }

  renderStock(stock);
}

function renderStock(stock) {
  if (!stock || !stock.items.length) {
    stockEl.innerHTML = '';
    return;
  }
  const group = kind => stock.items.filter(i => i.kind === kind);
  const section = (title, items) => items.length ? `
    <h3 class="show-section-title">${title}</h3>
    <div class="show-grid">${items.map(itemHTML).join('')}</div>` : '';

  stockEl.innerHTML =
    section('Singles', group('single')) +
    section('Sealed Packs', group('pack')) +
    section('Booster Box', group('box'));
}

function itemHTML(it) {
  const afford = state.money >= it.price;
  const art = it.kind === 'single' ? it.card.image : it.image;
  const name = it.kind === 'single' ? it.card.name : it.kind === 'box' ? `${it.setName} Box` : `${it.setName} Pack`;
  const rarity = it.kind === 'single' ? it.card.tier : (it.kind === 'box' ? 'ultra' : 'secret');
  const priceHTML = it.deal
    ? `<span class="show-list">${formatPrice(it.listPrice)}</span> <span class="show-price deal">${formatPrice(it.price)}</span>`
    : `<span class="show-price">${formatPrice(it.price)}</span>`;
  return `
    <div class="show-item${it.sold ? ' sold' : ''}" data-rarity="${rarity}">
      ${it.deal ? `<div class="deal-badge">DEAL</div>` : ''}
      ${it.kind === 'box' ? `<div class="count-badge">${it.packs}pk</div>` : ''}
      <div class="show-art">
        ${art ? `<img src="${art}" alt="${name}" loading="lazy" onerror="this.classList.add('img-fail')">` : `<div class="show-synth">?</div>`}
      </div>
      <div class="show-name">${name}</div>
      <div class="show-pricetag">${priceHTML}</div>
      ${it.sold
        ? `<button class="btn show-buy" disabled>Sold</button>`
        : `<button class="btn show-buy${afford ? '' : ' disabled-look'}" data-item="${it.id}">Buy</button>`}
    </div>`;
}

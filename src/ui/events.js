/* The Events tab. First event: the Card Show — attend once an hour to buy a
   one-time lineup of real single cards (market + deals), packs, and a box, at a
   show discount. Stock generation is in game/cardshow.js; the lineup persists in
   state so you can keep buying until the next show. */

import { state, enterCardShow, buyShowItem, tradeForShowItem, isLocked, isSleeved,
         consignCard, processAuctions } from '../state/store.js';
import { SETS } from '../data/sets.js';
import { loadedSet } from '../services/cards.js';
import { generateStock } from '../game/cardshow.js';
import { cardShowCooldownRemaining, formatCooldown, sellValue } from '../game/economy.js';
import { formatPrice, RARITY_FALLBACK } from '../services/prices.js';
import { playClick, playCoin } from '../services/audio.js';
import { toast } from './toast.js';

let headEl, stockEl;
let tradeBackdrop, tradeTargetEl, tradeSummaryEl, tradeOfferEl, tradeCompleteBtn;
let tradeItemId = null;
const tradeSelected = new Set(); // offered uids (one copy each)

let auctionLotsEl, consignBackdrop, consignOfferEl, consignControlsEl, consignSelectedEl, consignReserveEl, consignListBtn;
let consignUid = null;

function eventsActive() {
  return document.getElementById('view-events').classList.contains('active');
}

export function initEvents() {
  headEl = document.getElementById('cardshow-head');
  stockEl = document.getElementById('cardshow-stock');

  headEl.addEventListener('click', e => {
    if (e.target.closest('#cardshow-enter')) enterShow();
  });
  stockEl.addEventListener('click', e => {
    const tradeBtn = e.target.closest('.show-trade');
    if (tradeBtn) { openTrade(tradeBtn.dataset.item); return; }

    const btn = e.target.closest('.show-buy');
    if (!btn || btn.disabled) return;
    const res = buyShowItem(btn.dataset.item, Date.now());
    if (!res) return;
    if (res.error === 'money') { toast('Not enough money', 'You can\'t afford that yet.'); return; }
    playCoin();
    const it = res.item;
    const what = it.kind === 'single' ? it.card.name : it.kind === 'box' ? `${it.setName} box` : `${it.setName} pack`;
    toast('Bought', `${what} → ${formatPrice(it.price)}${it.kind === 'single' ? ' (in your binder)' : ' (Binder ▸ Sealed)'}`);
    renderEvents();
  });

  // Trade modal wiring.
  tradeBackdrop   = document.getElementById('trade-backdrop');
  tradeTargetEl   = document.getElementById('trade-target');
  tradeSummaryEl  = document.getElementById('trade-summary');
  tradeOfferEl    = document.getElementById('trade-offer');
  tradeCompleteBtn = document.getElementById('trade-complete');
  document.getElementById('trade-close').addEventListener('click', closeTrade);
  tradeBackdrop.addEventListener('click', e => { if (e.target === tradeBackdrop) closeTrade(); });
  tradeOfferEl.addEventListener('click', e => {
    const card = e.target.closest('.mini-card');
    if (!card) return;
    const uid = card.dataset.uid;
    if (tradeSelected.has(uid)) tradeSelected.delete(uid); else tradeSelected.add(uid);
    renderTrade();
  });
  tradeCompleteBtn.addEventListener('click', completeTrade);

  // Auction House wiring.
  auctionLotsEl    = document.getElementById('auction-lots');
  consignBackdrop  = document.getElementById('consign-backdrop');
  consignOfferEl   = document.getElementById('consign-offer');
  consignControlsEl = document.getElementById('consign-controls');
  consignSelectedEl = document.getElementById('consign-selected');
  consignReserveEl = document.getElementById('consign-reserve');
  consignListBtn   = document.getElementById('consign-list');
  document.getElementById('auction-consign').addEventListener('click', openConsign);
  document.getElementById('consign-close').addEventListener('click', closeConsign);
  consignBackdrop.addEventListener('click', e => { if (e.target === consignBackdrop) closeConsign(); });
  consignOfferEl.addEventListener('click', e => {
    const card = e.target.closest('.mini-card');
    if (card) selectConsign(card.dataset.uid);
  });
  consignListBtn.addEventListener('click', listConsign);

  // Global ticker: settle/advance auctions even off-tab (with toasts), and keep
  // the countdowns live while on the Events tab.
  setInterval(() => {
    const now = Date.now();
    processAuctions(now).forEach(o => {
      if (o.type === 'sold') { playCoin(); toast('Sold at auction!', `${o.card.name} → +${formatPrice(o.amount)}`); }
      else toast('Unsold', `${o.card.name} missed its ${formatPrice(o.reserve)} reserve — returned to your binder.`);
    });
    if (eventsActive()) renderEvents();
  }, 600);
}

function currentTradeItem() {
  return state.cardShowStock?.items.find(i => i.id === tradeItemId && !i.sold) || null;
}

function openTrade(itemId) {
  tradeItemId = itemId;
  tradeSelected.clear();
  if (!currentTradeItem()) return;
  renderTrade();
  tradeBackdrop.classList.add('show');
}

function closeTrade() {
  tradeBackdrop.classList.remove('show');
  tradeItemId = null;
  tradeSelected.clear();
}

function offerableEntries() {
  return Object.values(state.binder)
    .filter(e => e.count >= 1 && !isLocked(e.card.uid) && !isSleeved(e.card.uid));
}

function renderTrade() {
  const item = currentTradeItem();
  if (!item) { closeTrade(); return; }
  const name = item.kind === 'single' ? item.card.name : item.kind === 'box' ? `${item.setName} Box` : `${item.setName} Pack`;
  tradeTargetEl.innerHTML = `<div class="trade-target-name">Trade for: <strong>${name}</strong></div>
    <div class="trade-target-price">Price ${formatPrice(item.price)}</div>`;

  let credit = 0;
  for (const uid of tradeSelected) {
    const e = state.binder[uid];
    if (e) credit += sellValue(e.card);
  }
  credit = +credit.toFixed(2);
  const cashNeeded = Math.max(0, +(item.price - credit).toFixed(2));
  const over = credit > item.price;
  tradeSummaryEl.innerHTML = `
    <span>Trade credit: <strong style="color:var(--neon-green)">${formatPrice(credit)}</strong></span>
    <span>Cash needed: <strong style="color:var(--neon-yellow)">${formatPrice(cashNeeded)}</strong></span>
    ${over ? `<span class="trade-warn">credit over price — no change given</span>` : ''}`;

  const entries = offerableEntries();
  tradeOfferEl.innerHTML = entries.length ? entries.map(e => {
    const c = e.card;
    const sel = tradeSelected.has(c.uid);
    return `
      <div class="mini-card${sel ? ' trade-selected' : ''}" data-uid="${c.uid}" data-rarity="${c.tier}" title="${c.name} · trade value ${formatPrice(sellValue(c))}">
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${sel ? `<div class="trade-check">✓</div>` : ''}
        <div class="mini-art"><img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')"></div>
        <div class="price-tag">${formatPrice(sellValue(c))}</div>
      </div>`;
  }).join('') : `<div class="empty">No tradeable cards (locked/sleeved cards can't be traded).</div>`;

  tradeCompleteBtn.disabled = tradeSelected.size === 0 || state.money < cashNeeded;
  tradeCompleteBtn.textContent = tradeSelected.size === 0 ? 'Select cards to offer'
    : cashNeeded > 0 ? `Complete Trade · pay ${formatPrice(cashNeeded)}` : 'Complete Trade';
}

function completeTrade() {
  const res = tradeForShowItem(tradeItemId, [...tradeSelected], Date.now());
  if (!res) { closeTrade(); return; }
  if (res.error) {
    toast('Trade failed', res.error === 'money' ? 'You can\'t cover the cash difference.' : 'Those cards can\'t be traded.');
    return;
  }
  playCoin();
  const it = res.item;
  const what = it.kind === 'single' ? it.card.name : it.kind === 'box' ? `${it.setName} box` : `${it.setName} pack`;
  toast('Traded!', `Got ${what}${res.cashPaid > 0 ? ` for ${formatPrice(res.cashPaid)} + cards` : ' for cards'}.`);
  closeTrade();
  renderEvents();
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
  renderAuctions();
}

/* ---- Auction House ---- */

function renderAuctions() {
  if (!auctionLotsEl) return;
  const lots = state.auctions || [];
  if (!lots.length) {
    auctionLotsEl.innerHTML = `<div class="empty">No active lots. Consign a card to auction it off.</div>`;
    return;
  }
  const now = Date.now();
  auctionLotsEl.innerHTML = lots.map(lot => {
    const left = Math.max(0, Math.round((lot.endsAt - now) / 1000));
    const met = lot.currentBid >= lot.reserve;
    return `
      <div class="auction-lot" data-rarity="${lot.card.tier}" title="${lot.card.name}">
        <div class="show-art"><img src="${lot.card.image}" alt="${lot.card.name}" loading="lazy" onerror="this.classList.add('img-fail')"></div>
        <div class="show-name">${lot.card.name}</div>
        <div class="auction-bid">Bid <strong>${formatPrice(lot.currentBid)}</strong></div>
        <div class="auction-meta ${met ? 'met' : 'short'}">Reserve ${formatPrice(lot.reserve)} ${met ? '✓' : ''}</div>
        <div class="auction-timer">${left}s left</div>
      </div>`;
  }).join('');
}

function marketGuess(card) {
  return card.price || RARITY_FALLBACK[card.tier] || 1;
}

function openConsign() {
  consignUid = null;
  consignControlsEl.style.display = 'none';
  renderConsignOffer();
  consignBackdrop.classList.add('show');
}
function closeConsign() {
  consignBackdrop.classList.remove('show');
  consignUid = null;
}
function renderConsignOffer() {
  const entries = Object.values(state.binder).filter(e => e.count >= 1 && !isLocked(e.card.uid) && !isSleeved(e.card.uid));
  consignOfferEl.innerHTML = entries.length ? entries.map(e => {
    const c = e.card;
    return `
      <div class="mini-card${consignUid === c.uid ? ' trade-selected' : ''}" data-uid="${c.uid}" data-rarity="${c.tier}" title="${c.name} · market ${formatPrice(marketGuess(c))}">
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${consignUid === c.uid ? `<div class="trade-check">✓</div>` : ''}
        <div class="mini-art"><img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')"></div>
        <div class="price-tag">${formatPrice(marketGuess(c))}</div>
      </div>`;
  }).join('') : `<div class="empty">No cards to consign (locked/sleeved cards can't be auctioned).</div>`;
}
function selectConsign(uid) {
  consignUid = uid;
  const e = state.binder[uid];
  if (!e) return;
  consignSelectedEl.textContent = `${e.card.name} · market ${formatPrice(marketGuess(e.card))}`;
  consignReserveEl.value = marketGuess(e.card).toFixed(2);
  consignControlsEl.style.display = '';
  renderConsignOffer();
}
function listConsign() {
  if (!consignUid) return;
  const reserve = parseFloat(consignReserveEl.value);
  if (!(reserve > 0)) { toast('Set a reserve', 'Enter a reserve price above $0.'); return; }
  const res = consignCard(consignUid, reserve, Date.now());
  if (!res || res.error) { toast('Can\'t consign', res?.error === 'protected' ? 'Locked/sleeved cards can\'t be auctioned.' : 'That card is unavailable.'); return; }
  playClick();
  toast('Consigned!', 'Your card is up for auction — watch the bids climb.');
  closeConsign();
  renderEvents();
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
        : `<button class="btn show-buy${afford ? '' : ' disabled-look'}" data-item="${it.id}">Buy</button>
           <button class="btn show-trade" data-item="${it.id}">Trade</button>`}
    </div>`;
}

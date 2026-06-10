/* Trade with a friend — fully offline, by copy-paste code. You build an offer
   (cards / packs / boxes / money), which is escrowed and encoded into an offer
   code; your friend imports it, builds a return, and gets a confirmation code;
   you import that to finish. See game/trade.js for the codec. */

import { state, createTradeOffer, cancelTradeOffer, acceptIncomingOffer, finalizeTrade,
         ownsBundle, isLocked, isSleeved } from '../state/store.js';
import { encodeOffer, encodeConfirm, decodeTrade } from '../game/trade.js';
import { SETS } from '../data/sets.js';
import { formatPrice } from '../services/prices.js';
import { playClick, playCoin } from '../services/audio.js';
import { toast } from './toast.js';

let homeEl, pendingEl, builderEl, codeEl, importInput, incomingEl,
    tbCards, tbPacks, tbBoxes, tbMoney, tbSummary, tbConfirmBtn, tbTitle,
    codeTitle, codeSub, codeOutput;

const builder = { mode: 'offer', offer: null, cards: new Set(), packs: {}, boxes: {}, money: 0 };

const setName = id => (SETS.find(s => s.id === id)?.name || id);

export function initTrade() {
  homeEl    = document.getElementById('trade-home');
  pendingEl = document.getElementById('trade-pending');
  builderEl = document.getElementById('trade-builder');
  codeEl    = document.getElementById('trade-code-screen');
  importInput = document.getElementById('trade-import-input');
  incomingEl  = document.getElementById('trade-incoming');
  tbCards   = document.getElementById('tb-cards');
  tbPacks   = document.getElementById('tb-packs');
  tbBoxes   = document.getElementById('tb-boxes');
  tbMoney   = document.getElementById('tb-money');
  tbSummary = document.getElementById('tb-summary');
  tbConfirmBtn = document.getElementById('tb-confirm');
  tbTitle   = document.getElementById('trade-builder-title');
  codeTitle = document.getElementById('trade-code-title');
  codeSub   = document.getElementById('trade-code-sub');
  codeOutput = document.getElementById('trade-code-output');

  document.getElementById('trade-import-btn').addEventListener('click', doImport);
  document.getElementById('tb-back').addEventListener('click', () => { showScreen('home'); renderTrade(); });
  tbConfirmBtn.addEventListener('click', tbConfirm);
  document.getElementById('trade-code-done').addEventListener('click', () => { showScreen('home'); renderTrade(); });
  document.getElementById('trade-code-copy').addEventListener('click', copyCode);

  // pending-area buttons (Create Offer / Cancel) via delegation
  pendingEl.addEventListener('click', e => {
    if (e.target.closest('.trade-create')) openBuilder('offer', null);
    else if (e.target.closest('.trade-cancel')) {
      cancelTradeOffer(Date.now()); playClick(); toast('Offer cancelled', 'Your items are back in your collection.'); renderTrade();
    } else if (e.target.closest('.trade-recopy')) showCode('Your offer code', 'Send this to your friend.', encodeOffer(state.outgoingTrade.id, state.outgoingTrade.give));
  });

  // builder selection
  tbCards.addEventListener('click', e => {
    const card = e.target.closest('.mini-card');
    if (!card) return;
    const uid = card.dataset.uid;
    if (builder.cards.has(uid)) builder.cards.delete(uid); else builder.cards.add(uid);
    renderBuilder();
  });
  const qtyHandler = store => e => {
    const inp = e.target.closest('input[data-set]');
    if (!inp) return;
    const v = Math.max(0, Math.floor(+inp.value || 0));
    builder[store][inp.dataset.set] = v;
    renderSummary();
  };
  tbPacks.addEventListener('input', qtyHandler('packs'));
  tbBoxes.addEventListener('input', qtyHandler('boxes'));
  tbMoney.addEventListener('input', () => { builder.money = Math.max(0, +tbMoney.value || 0); renderSummary(); });

  renderTrade();
}

function showScreen(name) {
  homeEl.style.display    = name === 'home' ? '' : 'none';
  builderEl.style.display = name === 'builder' ? '' : 'none';
  codeEl.style.display    = name === 'code' ? '' : 'none';
}

function bundleSummary(b) {
  const parts = [];
  if ((b.cards || []).length) parts.push(`${b.cards.length} card${b.cards.length > 1 ? 's' : ''}`);
  const pk = Object.values(b.packs || {}).reduce((a, n) => a + n, 0);
  if (pk) parts.push(`${pk} pack${pk > 1 ? 's' : ''}`);
  if ((b.boxes || []).length) parts.push(`${b.boxes.length} box${b.boxes.length > 1 ? 'es' : ''}`);
  if (b.money > 0) parts.push(formatPrice(b.money));
  return parts.length ? parts.join(' · ') : 'nothing';
}

/* The Trade home: your pending offer (with its code + cancel) or a Create button. */
export function renderTrade() {
  if (!pendingEl) return;
  const t = state.outgoingTrade;
  if (t) {
    pendingEl.innerHTML = `
      <div class="trade-pending-card">
        <div class="trade-pending-head">⏳ Pending offer — you're giving <strong>${bundleSummary(t.give)}</strong></div>
        <p class="cardshow-sub">Waiting for your friend's confirmation code. (You can re-copy your offer code or cancel to get your items back.)</p>
        <div class="actions">
          <button class="btn trade-recopy">Show offer code</button>
          <button class="btn trade-cancel">Cancel offer</button>
        </div>
      </div>`;
  } else {
    pendingEl.innerHTML = `<div class="actions"><button class="btn primary trade-create">Create an offer</button></div>`;
  }
}

function openBuilder(mode, offer) {
  builder.mode = mode;
  builder.offer = offer;
  builder.cards = new Set();
  builder.packs = {};
  builder.boxes = {};
  builder.money = 0;
  tbMoney.value = '0';
  tbTitle.textContent = mode === 'offer' ? 'Create an offer' : 'Build your return';
  tbConfirmBtn.textContent = mode === 'offer' ? 'Create Offer' : 'Accept Trade';
  incomingEl.innerHTML = (mode === 'return' && offer)
    ? `<div class="trade-incoming-box">Your friend is offering: <strong>${bundleSummary(offer.give)}</strong></div>` : '';
  renderBuilder();
  showScreen('builder');
}

function renderBuilder() {
  // cards
  const entries = Object.values(state.binder).filter(e => e.count >= 1 && !isLocked(e.card.uid) && !isSleeved(e.card.uid));
  tbCards.innerHTML = entries.length ? entries.map(e => {
    const c = e.card, sel = builder.cards.has(c.uid);
    return `
      <div class="mini-card${sel ? ' trade-selected' : ''}" data-uid="${c.uid}" data-rarity="${c.tier}" title="${c.name} · ${formatPrice(c.price)}">
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${sel ? `<div class="trade-check">✓</div>` : ''}
        <div class="mini-art"><img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')"></div>
        <div class="price-tag">${formatPrice(c.price)}</div>
      </div>`;
  }).join('') : `<div class="empty">No tradeable cards.</div>`;

  // packs
  const packSets = SETS.filter(s => (state.sealed[s.id] || 0) > 0);
  tbPacks.innerHTML = packSets.length ? packSets.map(s => `
    <div class="trade-qty-row">
      <span>${s.name} <span class="trade-sec-hint">(you have ${state.sealed[s.id]})</span></span>
      <input type="number" data-set="${s.id}" min="0" max="${state.sealed[s.id]}" value="${builder.packs[s.id] || 0}" class="search-box trade-qty">
    </div>`).join('') : `<div class="empty">No sealed packs.</div>`;

  // boxes
  const boxSets = SETS.filter(s => (state.boxes[s.id] || []).length > 0);
  tbBoxes.innerHTML = boxSets.length ? boxSets.map(s => `
    <div class="trade-qty-row">
      <span>${s.name} <span class="trade-sec-hint">(you have ${state.boxes[s.id].length})</span></span>
      <input type="number" data-set="${s.id}" min="0" max="${state.boxes[s.id].length}" value="${builder.boxes[s.id] || 0}" class="search-box trade-qty">
    </div>`).join('') : `<div class="empty">No booster boxes.</div>`;

  renderSummary();
}

function builderBundle() {
  const cards = [...builder.cards].map(uid => state.binder[uid]?.card).filter(Boolean);
  const packs = {};
  for (const [s, n] of Object.entries(builder.packs)) if (n > 0) packs[s] = Math.min(n, state.sealed[s] || 0);
  const boxes = [];
  for (const [s, n] of Object.entries(builder.boxes)) {
    const arr = state.boxes[s] || [];
    for (let i = 0; i < Math.min(n, arr.length); i++) boxes.push({ setId: s, packs: arr[i] });
  }
  return { cards, packs, boxes, money: +builder.money || 0 };
}

function renderSummary() {
  const b = builderBundle();
  tbSummary.textContent = `You'll give: ${bundleSummary(b)}`;
}

function tbConfirm() {
  const bundle = builderBundle();
  const now = Date.now();
  if (builder.mode === 'offer') {
    const res = createTradeOffer(bundle, now);
    if (res.error) { toast('Can\'t create offer', res.error === 'empty' ? 'Add something to offer.' : res.error === 'pending' ? 'You already have a pending offer.' : 'You don\'t own all of that.'); return; }
    playClick();
    renderTrade();
    showCode('Your offer code', 'Send this to your friend. They import it, add their return, and send you back a confirmation code.', encodeOffer(res.trade.id, res.trade.give));
  } else {
    const res = acceptIncomingOffer(builder.offer, bundle, now);
    if (res.error) { toast('Can\'t accept', 'You don\'t own all of your return bundle.'); return; }
    playCoin();
    toast('Trade accepted', 'You received your friend\'s items. Send them the confirmation code to finish.');
    renderTrade();
    showCode('Confirmation code', 'Send this back to your friend so they receive your return and complete the trade.', encodeConfirm(res.confirm.id, res.confirm.give));
  }
}

function doImport() {
  const parsed = decodeTrade(importInput.value);
  if (!parsed) { toast('Bad code', 'That doesn\'t look like a valid POKETRADE code.'); return; }
  importInput.value = '';
  if (parsed.type === 'offer') {
    openBuilder('return', { id: parsed.id, give: parsed.give });
  } else {
    const res = finalizeTrade({ id: parsed.id, give: parsed.give }, Date.now());
    if (res.error) {
      toast('Can\'t finalize', res.error === 'no-offer' ? 'You have no pending offer to finalize.' : 'That confirmation doesn\'t match your pending offer.');
      return;
    }
    playCoin();
    toast('Trade complete!', `You received ${bundleSummary(parsed.give)}.`);
    renderTrade();
  }
}

function showCode(title, sub, code) {
  codeTitle.textContent = title;
  codeSub.textContent = sub;
  codeOutput.value = code;
  showScreen('code');
}

function copyCode() {
  codeOutput.select();
  try { navigator.clipboard.writeText(codeOutput.value); } catch { try { document.execCommand('copy'); } catch {} }
  playClick();
  toast('Copied', 'Code copied to your clipboard.');
}

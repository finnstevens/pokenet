/* Shop view: claim the daily reward, list cards for sale, and watch listings
   sell over a short time. Selling isn't instant — a listed card sits "on the
   market" with a live countdown, then pays out automatically (handled by a
   ticker so it completes even off this tab). Any owned card is sellable,
   including the last copy. */

import { state, sellableCards, listForSale, processSales, claimDaily, isLocked } from '../state/store.js';
import { sellValue, sellDurationMs, dailyCooldownRemaining, formatCooldown, DAILY_REWARD } from '../game/economy.js';
import { formatPrice } from '../services/prices.js';
import { playCoin, playClick } from '../services/audio.js';
import { toast } from './toast.js';

let dailyEl, sellingSection, sellingEl, dupesEl;

export function initShop() {
  dailyEl = document.getElementById('daily-claim');
  sellingSection = document.getElementById('selling-section');
  sellingEl = document.getElementById('selling');
  dupesEl = document.getElementById('dupes');

  dailyEl.addEventListener('click', e => {
    if (!e.target.closest('#daily-btn')) return;
    const reward = claimDaily(Date.now());
    if (reward > 0) { playCoin(); toast('Daily Reward', `+${formatPrice(reward)} claimed!`); }
    renderShop();
  });

  dupesEl.addEventListener('click', e => {
    const card = e.target.closest('.dupe-card');
    if (!card) return;
    if (isLocked(card.dataset.uid)) {
      toast('Locked', 'Unlock this card in the Binder before selling.');
      return;
    }
    const sale = listForSale(card.dataset.uid, Date.now());
    if (sale) { playClick(); toast('Listed', `${sale.card.name} — selling for ${formatPrice(sale.value)}…`); }
    renderShop();
  });

  // Ticker: complete elapsed sales (credits money + toasts) and keep the
  // countdowns ticking. Runs regardless of which tab is showing.
  setInterval(() => {
    const done = processSales(Date.now());
    done.forEach(s => { playCoin(); toast('Sold', `${s.card.name} → +${formatPrice(s.value)}`); });
    if (document.getElementById('view-shop').classList.contains('active')) renderShop();
  }, 250);
}

export function renderShop() {
  if (!dailyEl) return;
  renderDaily();
  renderSelling();
  renderSellable();
}

function renderDaily() {
  const remaining = dailyCooldownRemaining(state.lastDailyClaim, Date.now());
  if (remaining > 0) {
    dailyEl.innerHTML = `
      <p>Next free reward in <strong style="color:var(--neon-yellow)">${formatCooldown(remaining)}</strong>.</p>
      <button class="btn" id="daily-btn" disabled>Claimed</button>
    `;
  } else {
    dailyEl.innerHTML = `
      <p>Your daily <strong style="color:var(--neon-green)">${formatPrice(DAILY_REWARD)}</strong> is ready to claim!</p>
      <button class="btn success" id="daily-btn">Claim ${formatPrice(DAILY_REWARD)}</button>
    `;
  }
}

function renderSelling() {
  const sales = state.pendingSales;
  if (!sales.length) { sellingSection.style.display = 'none'; return; }
  sellingSection.style.display = '';

  const now = Date.now();
  // Soonest-to-complete first.
  const ordered = [...sales].sort((a, b) => a.readyAt - b.readyAt);

  sellingEl.innerHTML = ordered.map(s => {
    const c = s.card;
    const total = s.readyAt - s.listedAt;
    const remaining = Math.max(0, s.readyAt - now);
    const pct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 100;
    const secs = (remaining / 1000).toFixed(1);
    return `
      <div class="dupe-card selling" data-rarity="${c.tier}" title="${c.name} — selling for ${formatPrice(s.value)}">
        <div class="mini-art">
          <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="sell-progress"><span style="width:${pct}%"></span></div>
        <div class="sell-tag listing">${remaining > 0 ? `${secs}s · ${formatPrice(s.value)}` : 'sold!'}</div>
      </div>
    `;
  }).join('');
}

function renderSellable() {
  const owned = sellableCards();
  if (owned.length === 0) {
    dupesEl.innerHTML = `<div class="empty">No cards to sell yet.</div>`;
    return;
  }

  owned.sort((a, b) => sellValue(b.card) - sellValue(a.card));

  dupesEl.innerHTML = owned.map(e => {
    const c = e.card;
    const locked = isLocked(c.uid);
    return `
      <div class="dupe-card${locked ? ' locked-card' : ''}" data-rarity="${c.tier}" data-uid="${c.uid}" title="${locked ? 'Locked — unlock in the Binder to sell' : `Sell one ${c.name} (${c.setName} #${c.number}) · ~${(sellDurationMs(c) / 1000)}s to sell`}">
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${locked ? `<div class="lock-badge">🔒</div>` : ''}
        ${c.isReverse ? `<div class="variant-badge mini">RV</div>` : ''}
        <div class="mini-art">
          <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="sell-tag">${locked ? 'locked' : '+' + formatPrice(sellValue(c))}</div>
      </div>
    `;
  }).join('');
}

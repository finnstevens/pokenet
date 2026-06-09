/* Shop view: claim the daily reward, list cards for sale, and watch listings
   sell over a short time. Selling isn't instant — a listed card sits "on the
   market" with a live countdown, then pays out automatically (handled by a
   ticker so it completes even off this tab). Any owned card is sellable,
   including the last copy. */

import { state, sellableCards, listForSale, processSales, claimDaily, isLocked, bulkSellCommonsUncommons, setShopTab,
         spendMoney, addSleeves, isSleeved, processGrading } from '../state/store.js';
import { sellValue, sellDurationMs, dailyCooldownRemaining, formatCooldown, DAILY_REWARD } from '../game/economy.js';
import { formatPrice } from '../services/prices.js';
import { playCoin, playClick } from '../services/audio.js';
import { toast } from './toast.js';

let dailyEl, sellingSection, sellingEl, dupesEl, bulkBtn, shopSubtabs, shopBuy, shopSell, sleeveCountEl, buySleevesBtn;

const SLEEVE_COST = 8;   // $ per box of sleeves
const SLEEVE_COUNT = 65; // sleeves per box

export function initShop() {
  dailyEl = document.getElementById('daily-claim');
  sellingSection = document.getElementById('selling-section');
  sellingEl = document.getElementById('selling');
  dupesEl = document.getElementById('dupes');
  bulkBtn = document.getElementById('bulk-sell-btn');
  shopSubtabs = document.getElementById('shop-subtabs');
  shopBuy = document.getElementById('shop-buy');
  shopSell = document.getElementById('shop-sell');
  sleeveCountEl = document.getElementById('sleeve-count');
  buySleevesBtn = document.getElementById('btn-buy-sleeves');

  shopSubtabs.addEventListener('click', e => {
    const tab = e.target.closest('.subtab');
    if (!tab) return;
    setShopTab(tab.dataset.sub);
  });

  buySleevesBtn.addEventListener('click', () => {
    if (state.money < SLEEVE_COST) {
      toast('Not enough money', `A box of sleeves costs $${SLEEVE_COST}.`);
      return;
    }
    spendMoney(SLEEVE_COST);
    addSleeves(SLEEVE_COUNT);
    playClick();
    toast('Sleeves added', `+${SLEEVE_COUNT} sleeves. Sleeve a card from its detail view to protect it.`);
    renderShop();
  });

  bulkBtn.addEventListener('click', () => {
    const { count, total } = bulkSellCommonsUncommons(Date.now());
    if (count > 0) { playClick(); toast('Listed', `${count} cards queued · ~${formatPrice(total)} total`); }
    else toast('Nothing to sell', 'No unlocked commons or uncommons.');
    renderShop();
  });

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
    if (isSleeved(card.dataset.uid)) {
      toast('Sleeved', 'Remove the sleeve (in the card view) before selling.');
      return;
    }
    const sale = listForSale(card.dataset.uid, Date.now());
    if (sale) { playClick(); toast('Listed', `${sale.card.name} — selling for ${formatPrice(sale.value)}…`); }
    renderShop();
  });

  // Ticker: complete elapsed sales (credits money + toasts), and advance the
  // live countdowns. Completion commits state → the store subscriber re-renders
  // the shop once; between completions we ONLY nudge the progress bars/labels in
  // place via tickSelling() — never rebuild innerHTML, which would reload every
  // <img> and make the grid flicker.
  setInterval(() => {
    const now = Date.now();
    const done = processSales(now);
    done.forEach(s => { playCoin(); toast('Sold', `${s.card.name} → +${formatPrice(s.value)}`); });
    const graded = processGrading(now);
    graded.forEach(s => { playClick(); toast(`Graded: PSA ${s.grade}`, `${s.card.name} → slab worth ${formatPrice(s.value)} (Binder ▸ Graded)`); });
    if (document.getElementById('view-shop').classList.contains('active')) tickSelling();
  }, 250);
}

/* Update only the countdown bar + time text of the already-rendered selling
   cards (matched by sale id). No DOM rebuild → no image flicker. Only the front
   sale is active; the rest read "queued". */
function tickSelling() {
  const sales = state.pendingSales;
  if (!sales.length) return;
  const now = Date.now();
  sales.forEach((s, i) => {
    const el = sellingEl.querySelector(`[data-saleid="${s.id}"]`);
    if (!el) return;
    const bar = el.querySelector('.sell-progress span');
    const tag = el.querySelector('.sell-tag');
    if (s.readyAt == null) {                 // queued — waiting its turn
      if (bar) bar.style.width = '0%';
      if (tag) tag.textContent = `queued · ${formatPrice(s.value)}`;
      return;
    }
    const total = s.readyAt - s.listedAt;
    const remaining = Math.max(0, s.readyAt - now);
    const pct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 100;
    if (bar) bar.style.width = pct + '%';
    if (tag) tag.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s · ${formatPrice(s.value)}` : 'sold!';
  });
}

export function renderShop() {
  if (!dailyEl) return;
  // Reflect the active Buy/Sell subtab.
  const tab = state.shopTab === 'sell' ? 'sell' : 'buy';
  shopSubtabs.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.sub === tab));
  shopBuy.style.display = tab === 'buy' ? '' : 'none';
  shopSell.style.display = tab === 'sell' ? '' : 'none';

  renderSupplies();
  renderDaily();
  renderBulk();
  renderSelling();
  renderSellable();
}

/* Sleeve inventory + buy button (in the Buy tab's Supplies section). */
function renderSupplies() {
  if (!sleeveCountEl) return;
  const n = state.sleeves || 0;
  sleeveCountEl.textContent = `${n} sleeve${n === 1 ? '' : 's'}`;
  buySleevesBtn.textContent = `Buy ${SLEEVE_COUNT} — $${SLEEVE_COST}`;
}

/* Reflect how many unlocked commons/uncommons can be bulk-sold, and for how much. */
function renderBulk() {
  let count = 0, total = 0;
  for (const [uid, e] of Object.entries(state.binder)) {
    if ((e.card.tier === 'common' || e.card.tier === 'uncommon') && !isLocked(uid)) {
      count += e.count;
      total += sellValue(e.card) * e.count;
    }
  }
  bulkBtn.disabled = count === 0;
  bulkBtn.textContent = count > 0
    ? `⬇ Sell ${count} commons & uncommons  ·  +${formatPrice(total)}`
    : '⬇ Sell all commons & uncommons';
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
  // Keep queue order — index 0 is the one actively selling.
  sellingEl.innerHTML = sales.map(s => {
    const c = s.card;
    const queued = s.readyAt == null;
    let pct = 0, label;
    if (queued) {
      label = `queued · ${formatPrice(s.value)}`;
    } else {
      const total = s.readyAt - s.listedAt;
      const remaining = Math.max(0, s.readyAt - now);
      pct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 100;
      label = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s · ${formatPrice(s.value)}` : 'sold!';
    }
    return `
      <div class="dupe-card selling${queued ? ' queued' : ''}" data-saleid="${s.id}" data-rarity="${c.tier}" title="${c.name} — selling for ${formatPrice(s.value)}">
        <div class="mini-art">
          <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="sell-progress"><span style="width:${pct}%"></span></div>
        <div class="sell-tag listing">${label}</div>
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
    const sleeved = isSleeved(c.uid);
    const protectedCard = locked || sleeved;
    const title = locked ? 'Locked — unlock in the Binder to sell'
      : sleeved ? 'Sleeved — remove the sleeve to sell'
      : `Sell one ${c.name} (${c.setName} #${c.number}) · ~${(sellDurationMs(c) / 1000)}s to sell`;
    return `
      <div class="dupe-card${protectedCard ? ' locked-card' : ''}" data-rarity="${c.tier}" data-uid="${c.uid}" title="${title}">
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${locked ? `<div class="lock-badge">🔒</div>` : ''}
        ${sleeved ? `<div class="sleeve-badge">🧷</div>` : ''}
        ${c.isReverse ? `<div class="variant-badge mini">RV</div>` : ''}
        <div class="mini-art">
          <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="sell-tag">${locked ? 'locked' : sleeved ? 'sleeved' : '+' + formatPrice(sellValue(c))}</div>
      </div>
    `;
  }).join('');
}

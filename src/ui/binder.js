/* The binder. Two subtabs:
   - Pokémon Cards: the singles you've pulled (rarity/wishlist filters, search,
     sort, detail modal). Entries keyed by card uid.
   - Pokémon Sealed: booster packs you've bought and kept sealed; open one
     anytime from here. */

import { state, isWished, isLocked, isSleeved, setBinderTab, takeBox, addSealedMany, listSlabForSale } from '../state/store.js';
import { SETS } from '../data/sets.js';
import { slabSellValue } from '../game/economy.js';
import { formatPrice } from '../services/prices.js';
import { showCard } from './modal.js';
import { openFromSealed, openManyFromSealed, openPackFromBox, ripBox } from './pack.js';
import { toast } from './toast.js';

const RARITY_ORDER = { secret: 0, ultra: 1, holo: 2, rare: 3, uncommon: 4, common: 5 };

let grid, sealedGrid, gradedGrid, subtabs, cardsPane, sealedPane, gradedPane;

export function initBinder() {
  grid = document.getElementById('binder');
  sealedGrid = document.getElementById('sealed-grid');
  gradedGrid = document.getElementById('graded-grid');
  subtabs = document.getElementById('binder-subtabs');
  cardsPane = document.getElementById('binder-cards');
  sealedPane = document.getElementById('binder-sealed');
  gradedPane = document.getElementById('binder-graded');

  grid.addEventListener('click', e => {
    const mini = e.target.closest('.mini-card');
    if (!mini) return;
    const entry = state.binder[mini.dataset.uid];
    if (entry) showCard(entry.card);
  });

  subtabs.addEventListener('click', e => {
    const tab = e.target.closest('.subtab');
    if (!tab) return;
    setBinderTab(tab.dataset.sub);
  });

  sealedGrid.addEventListener('click', e => {
    const openBtn = e.target.closest('.open-sealed');
    if (openBtn) { openFromSealed(openBtn.dataset.set); return; }

    const manyBtn = e.target.closest('.open-many');
    if (manyBtn) { openManyFromSealed(manyBtn.dataset.set, 5); return; }

    const boxBtn = e.target.closest('.box-action');
    if (!boxBtn) return;
    const setId = boxBtn.dataset.set;
    if (boxBtn.classList.contains('open-box-pack')) {
      openPackFromBox(setId);
    } else if (boxBtn.classList.contains('rip-box')) {
      ripBox(setId);
    } else if (boxBtn.classList.contains('unbox')) {
      const n = takeBox(setId);
      if (n) {
        addSealedMany(setId, n);
        const set = SETS.find(s => s.id === setId);
        toast('Unboxed', `${n} sealed ${set ? set.name : ''} packs added to your sealed collection.`);
      }
    }
  });

  gradedGrid.addEventListener('click', e => {
    const btn = e.target.closest('.sell-slab');
    if (!btn) return;
    const sale = listSlabForSale(btn.dataset.slab, Date.now());
    if (sale) toast('Listed', `${sale.card.name} — selling for ${formatPrice(sale.value)}…`);
  });

  // Live countdown for in-progress grading jobs (text-only, no image rebuild).
  setInterval(() => {
    if (state.binderTab !== 'graded' || !state.grading.length) return;
    const now = Date.now();
    state.grading.forEach(j => {
      const el = gradedGrid.querySelector(`.slab-timer[data-jobid="${j.id}"]`);
      if (el) el.textContent = `${Math.max(0, (j.readyAt - now) / 1000).toFixed(1)}s left`;
    });
  }, 250);
}

function sortEntries(list) {
  const byRarity = (a, b) =>
    (RARITY_ORDER[a.card.tier] - RARITY_ORDER[b.card.tier]) || a.card.name.localeCompare(b.card.name);
  const comparators = {
    rarity: byRarity,
    name:   (a, b) => a.card.name.localeCompare(b.card.name),
    dex:    (a, b) => (a.card.setId || '').localeCompare(b.card.setId || '') || (parseInt(a.card.number) || 0) - (parseInt(b.card.number) || 0),
    count:  (a, b) => (b.count - a.count) || a.card.name.localeCompare(b.card.name),
    value:  (a, b) => ((b.card.price || 0) - (a.card.price || 0)) || a.card.name.localeCompare(b.card.name),
  };
  list.sort(comparators[state.sort] || byRarity);
  return list;
}

export function renderBinder() {
  if (!grid) return;

  // Reflect the active subtab.
  const tab = ['cards', 'sealed', 'graded'].includes(state.binderTab) ? state.binderTab : 'cards';
  subtabs.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.sub === tab));
  cardsPane.style.display = tab === 'cards' ? '' : 'none';
  sealedPane.style.display = tab === 'sealed' ? '' : 'none';
  gradedPane.style.display = tab === 'graded' ? '' : 'none';

  renderCards();
  renderSealed();
  renderGraded();
}

function renderGraded() {
  if (!gradedGrid) return;
  const now = Date.now();
  const jobs = state.grading || [];
  const slabs = state.graded || [];

  if (!jobs.length && !slabs.length) {
    gradedGrid.innerHTML = `<div class="empty">No graded cards yet. Open a card and tap “🔬 Grade” to send it off. Sleeve a card first to preserve its condition for a higher grade.</div>`;
    return;
  }

  const jobHTML = jobs.map(j => {
    const remaining = Math.max(0, j.readyAt - now);
    return `
      <div class="slab-card grading-job" data-rarity="${j.card.tier}" title="${j.card.name} — grading">
        <div class="slab-badge pending">GRADING…</div>
        <div class="sealed-art">
          <img src="${j.card.image}" alt="${j.card.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="slab-name">${j.card.name}</div>
        <div class="slab-timer" data-jobid="${j.id}">${(remaining / 1000).toFixed(1)}s left</div>
      </div>`;
  }).join('');

  const slabHTML = slabs.map(s => `
      <div class="slab-card graded grade-${s.grade}" data-rarity="${s.card.tier}" title="${s.card.name} · PSA ${s.grade}">
        <div class="slab-badge grade">PSA ${s.grade}</div>
        <div class="sealed-art">
          <img src="${s.card.image}" alt="${s.card.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        <div class="slab-name">${s.card.name}</div>
        <div class="price-tag">${formatPrice(s.value)}</div>
        <button class="btn sell-slab" data-slab="${s.id}">Sell · ${formatPrice(slabSellValue(s))}</button>
      </div>`).join('');

  gradedGrid.innerHTML = jobHTML + slabHTML;
}

function renderCards() {
  const entries = Object.values(state.binder);
  const q = state.search.trim().toLowerCase();
  let list = entries;
  if (state.currentFilter === 'wishlist') {
    list = list.filter(e => isWished(e.card.uid));
  } else if (state.currentFilter !== 'all') {
    list = list.filter(e => e.card.tier === state.currentFilter);
  }
  if (q) list = list.filter(e => e.card.name.toLowerCase().includes(q));
  sortEntries(list);

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty">${emptyMessage()}</div>`;
    return;
  }

  grid.innerHTML = list.map(e => {
    const c = e.card;
    const totalForOwned = (c.price || 0) * e.count;
    const priceHTML = `<div class="price-tag">${formatPrice(c.price)}${e.count > 1 ? ` <span style="opacity:.6">(×${e.count}=${formatPrice(totalForOwned)})</span>` : ''}</div>`;
    return `
      <div class="mini-card" data-rarity="${c.tier}" data-uid="${c.uid}" title="${c.name} · ${c.rarity} · ${c.setName} #${c.number}">
        ${isWished(c.uid) ? `<div class="wish-badge">★</div>` : ''}
        ${isLocked(c.uid) ? `<div class="lock-badge">🔒</div>` : ''}
        ${isSleeved(c.uid) ? `<div class="sleeve-badge">🧷</div>` : ''}
        ${e.count > 1 ? `<div class="count-badge">x${e.count}</div>` : ''}
        ${c.isReverse ? `<div class="variant-badge mini">RV</div>` : ''}
        <div class="mini-art">
          <img src="${c.image}" alt="${c.name}" loading="lazy" onerror="this.classList.add('img-fail')">
        </div>
        ${priceHTML}
      </div>
    `;
  }).join('');
}

function renderSealed() {
  const heldBoxes = SETS.filter(s => (state.boxes[s.id] || []).length > 0);
  const heldPacks = SETS.filter(s => (state.sealed[s.id] || 0) > 0);

  if (heldBoxes.length === 0 && heldPacks.length === 0) {
    sealedGrid.innerHTML = `<div class="empty">Nothing sealed yet. In the Buy tab, choose “Keep Sealed” to bank a pack, or “Buy Box” to bank a whole booster box here.</div>`;
    return;
  }

  const boxHTML = heldBoxes.map(set => {
    const boxes = state.boxes[set.id];
    const packsLeft = boxes.reduce((a, b) => a + b, 0);
    const each = set.box ? set.box.price : 0;
    return `
      <div class="sealed-card box-card" data-rarity="ultra" title="${set.name} · ${boxes.length} box · ${packsLeft} packs left">
        <div class="count-badge">x${boxes.length} 📦</div>
        <div class="sealed-art">
          <img src="./assets/packs/${set.id}.png" alt="${set.name}" loading="lazy"
               onerror="this.classList.add('img-fail')">
        </div>
        <div class="sealed-name">${set.name} Box</div>
        <div class="box-meta">${packsLeft} packs left · ${formatPrice(each)} ea</div>
        <div class="box-actions">
          <button class="btn box-action open-box-pack" data-set="${set.id}">Open 1 pack</button>
          <button class="btn box-action rip-box" data-set="${set.id}">Rip a box</button>
          <button class="btn box-action unbox" data-set="${set.id}">Take out packs</button>
        </div>
      </div>
    `;
  }).join('');

  const packHTML = heldPacks.map(set => {
    const count = state.sealed[set.id];
    const each = set.sealedPrice ?? set.cost; // sealed-pack market value
    return `
      <div class="sealed-card" data-rarity="secret" title="${set.name} · ${count} sealed">
        <div class="count-badge">x${count}</div>
        <div class="sealed-art">
          <img src="./assets/packs/${set.id}.png" alt="${set.name}" loading="lazy"
               onerror="this.classList.add('img-fail')">
        </div>
        <div class="sealed-name">${set.name}</div>
        <div class="price-tag">${formatPrice(each)} ea</div>
        <button class="btn open-sealed" data-set="${set.id}">Open one</button>
        ${count >= 2 ? `<button class="btn open-many" data-set="${set.id}">Open ${Math.min(5, count)}</button>` : ''}
      </div>
    `;
  }).join('');

  sealedGrid.innerHTML = boxHTML + packHTML;
}

function emptyMessage() {
  if (state.search.trim()) return 'No cards match your search.';
  if (state.currentFilter === 'wishlist') return 'Your wishlist is empty. Star a card to track it.';
  if (state.currentFilter !== 'all') return 'No cards of this rarity yet. Keep ripping!';
  return 'No cards yet. Rip a pack to start collecting.';
}

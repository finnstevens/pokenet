/* The binder. Two subtabs:
   - Pokémon Cards: the singles you've pulled (rarity/wishlist filters, search,
     sort, detail modal). Entries keyed by card uid.
   - Pokémon Sealed: booster packs you've bought and kept sealed; open one
     anytime from here. */

import { state, isWished, isLocked, setBinderTab } from '../state/store.js';
import { SETS } from '../data/sets.js';
import { formatPrice } from '../services/prices.js';
import { showCard } from './modal.js';
import { openFromSealed } from './pack.js';

const RARITY_ORDER = { secret: 0, ultra: 1, holo: 2, rare: 3, uncommon: 4, common: 5 };

let grid, sealedGrid, subtabs, cardsPane, sealedPane;

export function initBinder() {
  grid = document.getElementById('binder');
  sealedGrid = document.getElementById('sealed-grid');
  subtabs = document.getElementById('binder-subtabs');
  cardsPane = document.getElementById('binder-cards');
  sealedPane = document.getElementById('binder-sealed');

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
    const btn = e.target.closest('.open-sealed');
    if (!btn) return;
    openFromSealed(btn.dataset.set);
  });
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
  const tab = state.binderTab === 'sealed' ? 'sealed' : 'cards';
  subtabs.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.sub === tab));
  cardsPane.style.display = tab === 'cards' ? '' : 'none';
  sealedPane.style.display = tab === 'sealed' ? '' : 'none';

  renderCards();
  renderSealed();
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
  const held = SETS.filter(s => (state.sealed[s.id] || 0) > 0);
  if (held.length === 0) {
    sealedGrid.innerHTML = `<div class="empty">No sealed packs. In the Open tab, choose “Keep Sealed” to bank a pack here instead of ripping it.</div>`;
    return;
  }

  sealedGrid.innerHTML = held.map(set => {
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
      </div>
    `;
  }).join('');
}

function emptyMessage() {
  if (state.search.trim()) return 'No cards match your search.';
  if (state.currentFilter === 'wishlist') return 'Your wishlist is empty. Star a card to track it.';
  if (state.currentFilter !== 'all') return 'No cards of this rarity yet. Keep ripping!';
  return 'No cards yet. Rip a pack to start collecting.';
}

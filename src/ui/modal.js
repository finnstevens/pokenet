/* Card detail modal: large real card image, set + number + variant, real price,
   owned count, and a wishlist toggle. */

import { formatPrice } from '../services/prices.js';
import { state, isWished, toggleWishlist, isLocked, toggleLock } from '../state/store.js';
import { playClick } from '../services/audio.js';

let backdrop, modal, currentUid = null;

export function initModal() {
  backdrop = document.getElementById('modal-backdrop');
  modal = document.getElementById('modal');
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function close() {
  backdrop.classList.remove('show');
  currentUid = null;
}

export function showCard(card) {
  currentUid = card.uid;
  const owned = state.binder[card.uid]?.count || 0;
  const wished = isWished(card.uid);
  const locked = isLocked(card.uid);

  modal.innerHTML = `
    <button class="modal-close" aria-label="close">×</button>
    <div class="modal-art-real">
      <img src="${card.image}" alt="${card.name}" onerror="this.classList.add('img-fail')">
    </div>
    <div class="modal-name">${card.name}${card.isReverse ? ' <span class="rev">(reverse)</span>' : ''}</div>
    <div class="modal-meta">
      <span>${card.setName}</span><span>·</span><span>#${card.number}</span><span>·</span><span>${card.rarity}</span>
    </div>
    <div class="modal-stats">
      <div class="item"><span class="v">${formatPrice(card.price)}</span><span class="l">Market</span></div>
      <div class="item"><span class="v">${owned}</span><span class="l">Owned</span></div>
    </div>
    <div class="modal-wish">
      <button class="btn ${wished ? 'success' : ''}" id="modal-wish-btn">
        ${wished ? '★ On Wishlist' : '☆ Add to Wishlist'}
      </button>
      <button class="btn ${locked ? 'primary' : ''}" id="modal-lock-btn">
        ${locked ? '🔒 Locked' : '🔓 Lock'}
      </button>
    </div>
  `;

  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#modal-wish-btn').addEventListener('click', () => {
    playClick();
    toggleWishlist(card.uid);
    showCard(card);
  });
  modal.querySelector('#modal-lock-btn').addEventListener('click', () => {
    playClick();
    toggleLock(card.uid);
    showCard(card);
  });

  backdrop.classList.add('show');
}

/* Renders a single reveal card. The face-front is now the real TCG card image
   (minimal chrome: a thin rarity-tier border + holo shimmer on hits + a price
   tag). Price is known up front from the card data — no async lookup. */

import { formatPrice } from '../services/prices.js';

export function cardInnerHTML(card) {
  return `
    <div class="face face-back"></div>
    <div class="face face-front card-real">
      ${card.isReverse ? `<div class="variant-badge">REVERSE</div>` : ''}
      <img src="${card.image}" alt="${card.name}" loading="lazy"
           onerror="this.classList.add('img-fail');this.alt='${card.name.replace(/'/g, '')}'">
    </div>
    <div class="card-price">${formatPrice(card.price)}</div>
  `;
}

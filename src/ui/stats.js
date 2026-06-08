/* Renders the top stats bar from current state. Subscribed to the store, so it
   refreshes on every commit. Portfolio value sums real per-card market prices. */

import { state, uniqueCount, secretCount, portfolioValue } from '../state/store.js';
import { formatPrice } from '../services/prices.js';

export function renderStats() {
  document.getElementById('stat-money').textContent = formatPrice(state.money);
  document.getElementById('stat-packs').textContent = state.packsOpened;
  document.getElementById('stat-cards').textContent = state.totalCards;
  document.getElementById('stat-unique').textContent = uniqueCount();
  document.getElementById('stat-secrets').textContent = secretCount();

  const total = portfolioValue();
  document.getElementById('stat-value').textContent = total > 0 ? formatPrice(total) : '$—';
}

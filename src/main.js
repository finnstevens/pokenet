/* Entry point. Loads saved state, initializes every UI module, wires the tab
   nav + binder controls, and subscribes the views to the store so they
   re-render on every state change. */

import { load, subscribe, setFilter, setSort, setSearch, state } from './state/store.js';

import { initFx } from './ui/fx.js';
import { initToast } from './ui/toast.js';
import { initModal } from './ui/modal.js';
import { initPack, renderPicker } from './ui/pack.js';
import { initBinder, renderBinder } from './ui/binder.js';
import { initShop, renderShop } from './ui/shop.js';
import { initWork, renderWork } from './ui/work.js';
import { initEvents, renderEvents } from './ui/events.js';
import { renderStats } from './ui/stats.js';

/* ---- boot ---- */
load();

initFx();
initToast();
initModal();
initPack();
initBinder();
initShop();
initWork();
initEvents();

wireTabs();
wireBinderControls();
restoreControlValues();

// Re-render everything whenever state changes.
subscribe(() => {
  renderStats();
  renderPicker();
  renderBinder();
  renderShop();
  renderWork();
  renderEvents();
});

// Initial paint.
renderStats();
renderPicker();
renderBinder();
renderShop();
renderWork();
renderEvents();

/* ---- tab navigation ---- */
function wireTabs() {
  const tabs = document.getElementById('tabs');
  tabs.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const name = tab.dataset.tab;

    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${name}`);
    });

    // Refresh time-sensitive views on entry.
    if (name === 'shop') renderShop();
    if (name === 'binder') renderBinder();
    if (name === 'work') renderWork();
    if (name === 'events') renderEvents();
  });
}

/* ---- binder filters / search / sort ---- */
function wireBinderControls() {
  document.getElementById('filters').addEventListener('click', e => {
    const f = e.target.closest('.filter');
    if (!f) return;
    document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === f));
    setFilter(f.dataset.filter);
  });

  document.getElementById('search').addEventListener('input', e => {
    setSearch(e.target.value);
  });

  document.getElementById('sort').addEventListener('change', e => {
    setSort(e.target.value);
  });
}

/* Reflect persisted filter/sort into the controls on load. */
function restoreControlValues() {
  document.querySelectorAll('.filter').forEach(f => {
    f.classList.toggle('active', f.dataset.filter === state.currentFilter);
  });
  document.getElementById('sort').value = state.sort;
}

/* "What's New" — a curated release-notes overlay opened from the footer.
   Content is in data/releases.js (trusted/static); `**bold**` is supported. */

import { RELEASES } from '../data/releases.js';
import { playClick } from '../services/audio.js';

let backdrop, body;

export function initReleases() {
  backdrop = document.getElementById('releases-backdrop');
  body = document.getElementById('releases-body');
  document.getElementById('releases-link').addEventListener('click', e => { e.preventDefault(); open(); });
  document.getElementById('releases-close').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  render();
}

const fmt = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function render() {
  body.innerHTML = RELEASES.map(r => `
    <div class="release-entry">
      <div class="release-date">${r.date}</div>
      <div class="release-title">${fmt(r.title)}</div>
      <ul class="release-items">${r.items.map(i => `<li>${fmt(i)}</li>`).join('')}</ul>
    </div>`).join('');
}

function open() { playClick(); backdrop.classList.add('show'); }
function close() { backdrop.classList.remove('show'); }

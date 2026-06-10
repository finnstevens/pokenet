/* Trainer name (username). Shown in the header badge and sent to the presence
   server so friends see who's online. First run prompts for one. */

import { state, setUsername } from '../state/store.js';
import { playClick } from '../services/audio.js';

let badge, backdrop, input, saveBtn, onChange = null;

export function initUsername(onUsernameChange) {
  onChange = onUsernameChange;
  badge = document.getElementById('trainer-badge');
  backdrop = document.getElementById('username-backdrop');
  input = document.getElementById('username-input');
  saveBtn = document.getElementById('username-save');

  badge.addEventListener('click', openPrompt);
  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  // Can't dismiss on first run (no name yet) — must pick one.
  backdrop.addEventListener('click', e => { if (e.target === backdrop && state.username) close(); });

  renderUsername();
  if (!state.username) openPrompt();
}

export function renderUsername() {
  if (badge) badge.textContent = `👤 ${state.username || 'Trainer'}`;
}

function openPrompt() {
  input.value = state.username || '';
  backdrop.classList.add('show');
  setTimeout(() => input.focus(), 50);
}
function close() { backdrop.classList.remove('show'); }

function save() {
  setUsername(input.value); // store trims + defaults to "Trainer" if blank
  playClick();
  close();
  renderUsername();
  if (onChange) onChange(state.username);
}

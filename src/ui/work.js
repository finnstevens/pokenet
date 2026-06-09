/* Restock Rush — the "day job" mini-game. Sort a stream of real cards into the
   right rarity bin against a 30s timer; score → capped payout, then a cooldown.
   Lives in the Work tab. Pure logic is in game/restock.js. */

import { state, addMoney, markWorked } from '../state/store.js';
import { SETS } from '../data/sets.js';
import { loadedSet } from '../services/cards.js';
import { SHIFT_MS, TIERS, scoreSort, payoutForScore, buildDeck } from '../game/restock.js';
import { workCooldownRemaining, WORK_PAYOUT_CAP, formatCooldown } from '../game/economy.js';
import { formatPrice } from '../services/prices.js';
import { playClick, playCoin } from '../services/audio.js';

let readyPane, playingPane, resultPane, startBtn, doneBtn, statusEl, binsEl,
    cardEl, scoreEl, comboEl, timerBar, resultBody;

let active = false;
let deck = [], idx = 0, score = 0, combo = 0, sorted = 0, correct = 0;
let startedAt = 0, lastPayout = null, tickId = null;

export function initWork() {
  readyPane   = document.getElementById('work-ready');
  playingPane = document.getElementById('work-playing');
  resultPane  = document.getElementById('work-result');
  startBtn    = document.getElementById('work-start');
  doneBtn     = document.getElementById('work-done');
  statusEl    = document.getElementById('work-status');
  binsEl      = document.getElementById('work-bins');
  cardEl      = document.getElementById('work-card');
  scoreEl     = document.getElementById('work-score');
  comboEl     = document.getElementById('work-combo');
  timerBar    = document.getElementById('work-timer-bar');
  resultBody  = document.getElementById('work-result-body');

  // Static bins (labelled + colour-coded).
  binsEl.innerHTML = TIERS.map((t, i) => `
    <button class="work-bin" data-tier="${t.tier}" data-rarity="${t.tier}" style="--bin:${t.color}">
      <span class="bin-key">${i + 1}</span>
      <span class="bin-label">${t.label}</span>
    </button>`).join('');

  startBtn.addEventListener('click', () => { playClick(); startShift(); });
  doneBtn.addEventListener('click', () => { playClick(); showPane('ready'); renderWork(); });
  binsEl.addEventListener('click', e => {
    const b = e.target.closest('.work-bin');
    if (b && active) sort(b.dataset.tier);
  });
  document.addEventListener('keydown', e => {
    if (!active) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= TIERS.length) sort(TIERS[n - 1].tier);
  });

  // Keep the cooldown countdown live while idling on the Work tab.
  setInterval(() => {
    if (!active && document.getElementById('view-work').classList.contains('active')) renderWork();
  }, 500);

  renderWork();
}

function showPane(name) {
  readyPane.style.display   = name === 'ready'   ? '' : 'none';
  playingPane.style.display = name === 'playing' ? '' : 'none';
  resultPane.style.display  = name === 'result'  ? '' : 'none';
}

/* Idle render: cooldown / last-payout status + Start button state. Never
   disturbs an in-progress shift. */
export function renderWork() {
  if (!readyPane || active) return;
  const remaining = workCooldownRemaining(state.lastWork, Date.now());
  if (remaining > 0) {
    startBtn.disabled = true;
    startBtn.textContent = `Next shift in ${formatCooldown(remaining)}`;
  } else {
    startBtn.disabled = false;
    startBtn.textContent = 'Start Shift';
  }
  statusEl.innerHTML = lastPayout != null
    ? `<p class="work-last">Last shift: <strong style="color:var(--neon-green)">+${formatPrice(lastPayout)}</strong></p>`
    : '';
}

function deckPool() {
  return SETS.flatMap(s => loadedSet(s.apiSetId) || []);
}

function startShift() {
  if (workCooldownRemaining(state.lastWork, Date.now()) > 0) return;
  deck = buildDeck(deckPool(), 160);
  idx = 0; score = 0; combo = 0; sorted = 0; correct = 0;
  active = true;
  startedAt = Date.now();
  showPane('playing');
  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  renderCard();
  clearInterval(tickId);
  tickId = setInterval(tick, 50);
}

function tick() {
  const elapsed = Date.now() - startedAt;
  const pct = Math.max(0, Math.min(100, 100 - (elapsed / SHIFT_MS) * 100));
  if (timerBar) timerBar.style.width = pct + '%';
  if (elapsed >= SHIFT_MS) endShift();
}

function renderCard() {
  const card = deck[idx];
  if (!card) { endShift(); return; }
  const rarity = card.rarity || (TIERS.find(t => t.tier === card.tier)?.label ?? card.tier);
  cardEl.dataset.rarity = card.tier;
  cardEl.innerHTML = `
    ${card.image ? `<img src="${card.image}" alt="" loading="eager" onerror="this.classList.add('img-fail')">`
                 : `<div class="work-card-synth">?</div>`}
    <div class="work-card-rarity">${rarity}</div>`;
}

function sort(tier) {
  const card = deck[idx];
  if (!card) return;
  const isCorrect = card.tier === tier;
  const res = scoreSort(isCorrect, combo);
  score = Math.max(0, score + res.points);
  combo = res.combo;
  sorted++;
  if (isCorrect) correct++;
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  cardEl.classList.remove('flash-good', 'flash-bad');
  void cardEl.offsetWidth; // restart the flash animation
  cardEl.classList.add(isCorrect ? 'flash-good' : 'flash-bad');
  playClick();
  idx++;
  renderCard();
}

function endShift() {
  if (!active) return;
  active = false;
  clearInterval(tickId);
  const payout = payoutForScore(score);
  lastPayout = payout;
  if (payout > 0) { addMoney(payout); playCoin(); }
  markWorked(Date.now());
  const acc = sorted ? Math.round((correct / sorted) * 100) : 0;
  resultBody.innerHTML = `
    <div class="work-result-stats">
      <div class="item"><span class="v">${score}</span><span class="l">Score</span></div>
      <div class="item"><span class="v">${correct}/${sorted}</span><span class="l">Sorted</span></div>
      <div class="item"><span class="v">${acc}%</span><span class="l">Accuracy</span></div>
      <div class="item"><span class="v" style="color:var(--neon-green)">+${formatPrice(payout)}</span><span class="l">Payout</span></div>
    </div>
    <p class="work-cap-note">${payout >= WORK_PAYOUT_CAP ? 'Maxed out the shift cap! ' : ''}Come back after the cooldown for another shift.</p>`;
  showPane('result');
}

/* Chiptune SFX synthesized live with the Web Audio API — no asset files, no
   dependencies. The AudioContext is created lazily on first user gesture
   (browsers block audio until then) and all sounds are short oscillator +
   gain-envelope blips that suit the neon-arcade aesthetic. */

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

/* One enveloped oscillator note. */
function tone({ freq, type = 'square', start = 0, dur = 0.12, gain = 0.15, slideTo = null }) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* Filtered noise burst — used for the "rip". */
function noise({ start = 0, dur = 0.3, gain = 0.12 }) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(t0);
}

/* ---- sound events ---- */

export function playShake() {
  // low rumbling wobble while the pack rattles
  for (let i = 0; i < 3; i++) {
    tone({ freq: 90 + Math.random() * 30, type: 'sawtooth', start: i * 0.16, dur: 0.14, gain: 0.08 });
  }
}

export function playTear() {
  noise({ dur: 0.35, gain: 0.14 });
  tone({ freq: 220, type: 'square', dur: 0.18, gain: 0.06, slideTo: 110 });
}

export function playFlip() {
  tone({ freq: 660, type: 'square', dur: 0.06, gain: 0.08 });
}

/* Rarity-scaled fanfare. Higher tiers get longer, brighter arpeggios. */
const FANFARES = {
  common:   [523],
  uncommon: [523, 659],
  rare:     [523, 659, 784],
  holo:     [523, 659, 784, 1047],
  ultra:    [659, 784, 988, 1319, 1568],
  secret:   [523, 784, 1047, 1319, 1568, 2093],
};

export function playFanfare(rarity) {
  const notes = FANFARES[rarity] || FANFARES.common;
  const step = rarity === 'secret' || rarity === 'ultra' ? 0.09 : 0.08;
  notes.forEach((f, i) => {
    tone({ freq: f, type: 'square', start: i * step, dur: 0.16, gain: 0.13 });
    // shimmer layer for the big pulls
    if (rarity === 'ultra' || rarity === 'secret') {
      tone({ freq: f * 2, type: 'triangle', start: i * step, dur: 0.16, gain: 0.05 });
    }
  });
}

export function playClick() {
  tone({ freq: 880, type: 'square', dur: 0.05, gain: 0.07 });
}

export function playCoin() {
  tone({ freq: 988, type: 'square', dur: 0.07, gain: 0.1 });
  tone({ freq: 1319, type: 'square', start: 0.07, dur: 0.12, gain: 0.1 });
}

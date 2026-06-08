/* Visual flourish for big pulls: a canvas particle burst + a screen flash, plus
   mobile haptics. Plain canvas, no library. Particles are confetti-ish neon
   shards that fall and fade. */

const COLORS = ['#ff2e9a', '#00f0ff', '#fff200', '#b829ff', '#39ff14'];

let canvas, gctx, particles = [], rafId = null;

export function initFx() {
  canvas = document.getElementById('fx-canvas');
  gctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawn(count) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2.4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!rafId) tick();
}

function tick() {
  gctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.vy += 0.22;          // gravity
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.rot += p.vrot;
    p.life -= 0.012;
  });
  particles = particles.filter(p => p.life > 0 && p.y < canvas.height + 40);

  particles.forEach(p => {
    gctx.save();
    gctx.globalAlpha = Math.max(0, p.life);
    gctx.translate(p.x, p.y);
    gctx.rotate(p.rot);
    gctx.fillStyle = p.color;
    gctx.shadowColor = p.color;
    gctx.shadowBlur = 8;
    gctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
    gctx.restore();
  });

  if (particles.length) {
    rafId = requestAnimationFrame(tick);
  } else {
    gctx.clearRect(0, 0, canvas.width, canvas.height);
    rafId = null;
  }
}

function flash() {
  const el = document.getElementById('screen-flash');
  el.classList.remove('go');
  void el.offsetWidth; // restart animation
  el.classList.add('go');
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

/* Intensity scales with rarity. Called when a pack is revealed. */
export function celebrate(rarity) {
  if (rarity === 'secret') {
    spawn(160); flash(); vibrate([40, 30, 80, 30, 120]);
  } else if (rarity === 'ultra') {
    spawn(90); flash(); vibrate([30, 30, 90]);
  } else if (rarity === 'holo') {
    spawn(45); vibrate(40);
  }
  // rare and below: no burst, keep it special
}

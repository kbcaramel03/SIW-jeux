// Effets dynamiques : explosions de particules (canvas-confetti) + sons (Web Audio).
import confetti from 'canvas-confetti';

// Petite explosion de particules centrée sur un élément du DOM (une case).
export function burstAtEl(el, big = false) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (r.left + r.width / 2) / window.innerWidth;
  const y = (r.top + r.height / 2) / window.innerHeight;
  confetti({
    particleCount: big ? 60 : 26,
    spread: big ? 85 : 55,
    startVelocity: big ? 42 : 26,
    origin: { x, y },
    colors: ['#ff7b54', '#ffd166', '#ef476f', '#ffffff', '#ffa94d'],
    scalar: big ? 1.1 : 0.8,
    ticks: big ? 110 : 80,
    gravity: 1.2,
    disableForReducedMotion: true,
  });
}

// Pluie de confettis de victoire depuis les deux côtés.
export function winConfetti() {
  const end = Date.now() + 1300;
  const colors = ['#cf7b97', '#9a83b4', '#ffd166', '#ffffff'];
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

let ctx;
function audio() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}

// Son d'explosion (oscillateur grave + bruit blanc).
export function boomSound(big = false) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(big ? 150 : 210, t);
  o.frequency.exponentialRampToValueAtTime(40, t + (big ? 0.45 : 0.3));
  g.gain.setValueAtTime(big ? 0.38 : 0.24, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.5 : 0.33));
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + (big ? 0.5 : 0.35));

  const len = Math.floor(c.sampleRate * 0.2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const n = c.createBufferSource(); n.buffer = buf;
  const ng = c.createGain(); ng.gain.setValueAtTime(big ? 0.28 : 0.16, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  n.connect(ng); ng.connect(c.destination); n.start(t);
}

// Son de dé qui roule : petits clics secs rapprochés.
export function diceSound() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 5; i++) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(900 + Math.random() * 700, t + i * 0.09);
    g.gain.setValueAtTime(0.05, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.05);
    o.connect(g); g.connect(c.destination);
    o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.06);
  }
}

// Petit "pop" doux (pion qui se pose).
export function popSound() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.09);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.13);
}

// Son "plouf" pour un tir à l'eau.
export function splashSound() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.18);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
}

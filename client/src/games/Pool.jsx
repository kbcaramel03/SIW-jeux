import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Target } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { getSocket } from '../socket.js';
import { winConfetti, popSound, boomSound } from '../effects.js';

// ---- Physique locale : COPIE de server/games/pool.js (garder synchronisé). --
// Le serveur reste l'autorité : on anime localement le même tir, puis on se
// cale sur les positions finales envoyées par le serveur.
const TABLE = { W: 2, H: 1, R: 0.026, POCKET_R: 0.058 };
const POCKETS = [
  [0.02, 0.02], [1, -0.012], [1.98, 0.02],
  [0.02, 0.98], [1, 1.012], [1.98, 0.98],
];
const FRICTION = 0.992, STOP = 0.00028, CUSHION = 0.92;

function stepBalls(balls) {
  const { R, W, H, POCKET_R } = TABLE;
  let moving = false;
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x += b.vx; b.y += b.vy;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < STOP) { b.vx = 0; b.vy = 0; } else moving = true;
    for (const [px, py] of POCKETS) {
      const dx = b.x - px, dy = b.y - py;
      if (dx * dx + dy * dy < POCKET_R * POCKET_R) { b.pocketed = true; b.vx = 0; b.vy = 0; break; }
    }
    if (b.pocketed) continue;
    if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx * CUSHION; }
    if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx * CUSHION; }
    if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy * CUSHION; }
    if (b.y > H - R && b.vy > 0) { b.y = H - R; b.vy = -b.vy * CUSHION; }
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (a.pocketed) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const c = balls[j]; if (c.pocketed) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0 && d2 < (2 * TABLE.R) * (2 * TABLE.R)) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = (2 * TABLE.R - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        c.x += nx * overlap; c.y += ny * overlap;
        const va = a.vx * nx + a.vy * ny;
        const vc = c.vx * nx + c.vy * ny;
        const diff = va - vc;
        if (diff > 0) {
          a.vx -= diff * nx; a.vy -= diff * ny;
          c.vx += diff * nx; c.vy += diff * ny;
          moving = true;
        }
      }
    }
  }
  return moving;
}

// Couleurs standard des billes.
const BALL_COLORS = { 1: '#f2c11f', 2: '#2b5fd4', 3: '#e0392e', 4: '#7a3fbf', 5: '#f28322', 6: '#2e9c5c', 7: '#8c3a2e', 8: '#1c1c22' };
const colorOf = (id) => (id === 0 ? '#f6f2ea' : id === 8 ? BALL_COLORS[8] : BALL_COLORS[((id - 1) % 8) + 1] || BALL_COLORS[id - 8]);
const isStripe = (id) => id >= 9 && id <= 15;

// Espace « logique » : table horizontale 880×440 + cadre. En mode vertical
// (téléphone), le canvas est pivoté de 90° au dessin, les nombres restent droits.
const CW = 880, CH = 440, PAD = 26;
const lx = (x) => PAD + (x / TABLE.W) * (CW - 2 * PAD);
const ly = (y) => PAD + (y / TABLE.H) * (CH - 2 * PAD);
const lr = (r) => (r / TABLE.W) * (CW - 2 * PAD);

// Lancer de rayon pour la visée : premier contact de la blanche sur son chemin
// (une bille = distance au choc centre à centre 2R, ou une bande = mur à R).
function castAim(balls, ox, oy, ux, uy) {
  const { R, W, H } = TABLE;
  let t = 3, type = 'none', vert = false;
  const walls = [
    ux < 0 && [(R - ox) / ux, true],
    ux > 0 && [(W - R - ox) / ux, true],
    uy < 0 && [(R - oy) / uy, false],
    uy > 0 && [(H - R - oy) / uy, false],
  ];
  for (const w of walls) {
    if (w && w[0] > 1e-6 && w[0] < t) { t = w[0]; type = 'cushion'; vert = w[1]; }
  }
  const rr = (2 * R) * (2 * R);
  for (const b of balls) {
    if (b.id === 0 || b.pocketed) continue;
    const cx = b.x - ox, cy = b.y - oy;
    const proj = cx * ux + cy * uy;
    if (proj <= 0) continue;
    const d2 = cx * cx + cy * cy - proj * proj;
    if (d2 >= rr) continue;
    const tt = proj - Math.sqrt(rr - d2);
    if (tt > 1e-6 && tt < t) { t = tt; type = 'ball'; }
  }
  return { t, type, vert };
}

function drawScene(ctx, balls, aim, vertical) {
  const w = vertical ? CH : CW, h = vertical ? CW : CH;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (vertical) { ctx.translate(CH, 0); ctx.rotate(Math.PI / 2); }

  // cadre bois + tapis
  ctx.fillStyle = '#6d4326';
  roundRect(ctx, 0, 0, CW, CH, 22); ctx.fill();
  const felt = ctx.createRadialGradient(CW / 2, CH / 2, 60, CW / 2, CH / 2, CW / 1.6);
  felt.addColorStop(0, '#2e8f5b'); felt.addColorStop(1, '#20714a');
  ctx.fillStyle = felt;
  roundRect(ctx, PAD - 8, PAD - 8, CW - 2 * (PAD - 8), CH - 2 * (PAD - 8), 12); ctx.fill();
  for (const [px, py] of POCKETS) {
    ctx.beginPath(); ctx.arc(lx(px), ly(py), lr(TABLE.POCKET_R) * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = '#101216'; ctx.fill();
  }

  const cue = balls.find((b) => b.id === 0);

  // Visée façon Plato : flèche colorée sur la bille (direction), trajectoire
  // complète en pointillés (avec premier rebond), queue reculée selon la
  // puissance du curseur. Visible aussi pendant le tour de l'adversaire.
  if (aim && cue && !cue.pocketed && (aim.dx || aim.dy)) {
    const len = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy) || 1;
    const ux = aim.dx / len, uy = aim.dy / len;
    ctx.setLineDash([14, 11]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    let px = cue.x, py = cue.y, dx = ux, dy = uy;
    for (let seg = 0; seg < 2; seg++) {
      const hit = castAim(balls, px, py, dx, dy);
      const ex = px + dx * hit.t, ey = py + dy * hit.t;
      ctx.beginPath();
      ctx.moveTo(lx(px), ly(py));
      ctx.lineTo(lx(ex), ly(ey));
      ctx.stroke();
      if (hit.type === 'ball') {
        // bille fantôme : là où la blanche frappera
        ctx.setLineDash([]);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(lx(ex), ly(ey), lr(TABLE.R), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 4;
        break;
      }
      if (hit.type !== 'cushion') break;
      if (hit.vert) dx = -dx; else dy = -dy; // rebond miroir sur la bande
      px = ex; py = ey;
    }
    ctx.setLineDash([]);

    // Mini flèche colorée SUR la bille : la direction qu'elle va prendre.
    const alen = 0.07 + 0.05 * (aim.power || 0);
    const ax0 = cue.x + ux * (TABLE.R + 0.006), ay0 = cue.y + uy * (TABLE.R + 0.006);
    const ax1 = cue.x + ux * (TABLE.R + alen), ay1 = cue.y + uy * (TABLE.R + alen);
    ctx.strokeStyle = '#ff4d7d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lx(ax0), ly(ay0)); ctx.lineTo(lx(ax1), ly(ay1)); ctx.stroke();
    ctx.fillStyle = '#ff4d7d';
    ctx.beginPath();
    ctx.moveTo(lx(ax1 + ux * 0.032), ly(ay1 + uy * 0.032));
    ctx.lineTo(lx(ax1 - uy * 0.017), ly(ay1 + ux * 0.017));
    ctx.lineTo(lx(ax1 + uy * 0.017), ly(ay1 - ux * 0.017));
    ctx.closePath(); ctx.fill();

    // Queue de billard reculée selon la puissance du curseur.
    if ((aim.power || 0) > 0.02) {
      const back = 0.06 + aim.power * 0.16;
      ctx.strokeStyle = '#caa06a';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx(cue.x - ux * (0.045 + back * 0.2)), ly(cue.y - uy * (0.045 + back * 0.2)));
      ctx.lineTo(lx(cue.x - ux * (0.045 + back)), ly(cue.y - uy * (0.045 + back)));
      ctx.stroke();
    }
  }

  // billes
  for (const b of balls) {
    if (b.pocketed) continue;
    const X = lx(b.x), Y = ly(b.y), Rp = lr(TABLE.R);
    const grad = ctx.createRadialGradient(X - Rp * 0.4, Y - Rp * 0.45, Rp * 0.2, X, Y, Rp);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, isStripe(b.id) ? '#f6f2ea' : colorOf(b.id));
    grad.addColorStop(1, shade(isStripe(b.id) ? '#f6f2ea' : colorOf(b.id)));
    ctx.beginPath(); ctx.arc(X, Y, Rp, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    if (isStripe(b.id)) {
      ctx.save();
      ctx.beginPath(); ctx.arc(X, Y, Rp, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = colorOf(b.id);
      ctx.fillRect(X - Rp, Y - Rp * 0.45, Rp * 2, Rp * 0.9);
      ctx.restore();
    }
    if (b.id > 0) {
      ctx.save();
      ctx.translate(X, Y);
      if (vertical) ctx.rotate(-Math.PI / 2); // les numéros restent lisibles
      ctx.beginPath(); ctx.arc(0, 0, Rp * 0.44, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = `bold ${Math.round(Rp * 0.62)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(b.id), 0, 0.5);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(X - Rp * 0.35, Y - Rp * 0.4, Rp * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.55));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export default function Pool({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));

  const canvasRef = useRef(null);
  const prevBallsRef = useRef(null);
  const animRef = useRef(null);
  const sliderRef = useRef(null);
  const slidingRef = useRef(false);
  const lastEmitRef = useRef(0);
  const [aim, setAim] = useState(null);       // { dx, dy } — direction seulement
  const [power, setPower] = useState(0);      // 0..1 — curseur de gauche
  const [oppAim, setOppAim] = useState(null); // visée de l'adversaire en direct
  const [animating, setAnimating] = useState(false);
  const [vertical, setVertical] = useState(typeof window !== 'undefined' && window.innerWidth < 700);
  const lastShotSeq = useRef(g.lastShot?.seq || 0);
  const pottedCount = useRef(g.balls?.filter((b) => b.pocketed).length || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  // Confettis SEULEMENT quand l'animation est finie (sinon ça spoile la fin).
  useEffect(() => {
    if (g.phase === 'over' && !animating && g.winner === me) { winConfetti(); boomSound(true); }
  }, [g.phase, animating]);

  // Visée de l'adversaire relayée par le serveur (flèche qui bouge en direct).
  useEffect(() => {
    const s = getSocket();
    const onAim = (a) => setOppAim(a && Number.isFinite(a.dx) ? a : null);
    s.on('pool:aim', onAim);
    return () => s.off('pool:aim', onAim);
  }, []);
  useEffect(() => { setOppAim(null); }, [g.turn, g.lastShot?.seq]);

  // À mon tour : flèche pointée par défaut vers la bille la plus proche.
  useEffect(() => {
    if (g.isMyTurn && !animating && g.phase === 'playing' && !aim) {
      const cue = g.balls.find((b) => b.id === 0);
      let best = null; let bd = Infinity;
      for (const b of g.balls) {
        if (b.pocketed || b.id === 0) continue;
        const d = (b.x - cue.x) ** 2 + (b.y - cue.y) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      if (best && cue) setAim({ dx: best.x - cue.x, dy: best.y - cue.y });
    }
    if (!g.isMyTurn) { setAim(null); setPower(0); slidingRef.current = false; }
  }, [g.isMyTurn, animating, g.phase]);

  function emitAim(a, p) {
    const now = Date.now();
    if (now - lastEmitRef.current < 90) return;
    lastEmitRef.current = now;
    getSocket().emit('pool:aim', { dx: a.dx, dy: a.dy, power: p });
  }
  // Table verticale sur écran étroit (téléphone), horizontale sinon.
  useEffect(() => {
    const onResize = () => setVertical(window.innerWidth < 700);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const render = (balls, aimLine) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawScene(ctx, balls, aimLine, vertical);
  };

  // Nouveau tir : rejoue la simulation localement pour l'animation.
  useEffect(() => {
    const shot = g.lastShot;
    if (!shot || shot.seq === lastShotSeq.current) {
      if (!animating) render(g.balls, shownAim);
      prevBallsRef.current = g.balls.map((b) => ({ ...b, vx: 0, vy: 0 }));
      return;
    }
    lastShotSeq.current = shot.seq;
    const start = prevBallsRef.current;
    prevBallsRef.current = g.balls.map((b) => ({ ...b, vx: 0, vy: 0 }));
    if (!start) { render(g.balls, null); return; }

    const balls = start.map((b) => ({ ...b }));
    const cue = balls.find((b) => b.id === 0);
    const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
    const speed = 0.008 + Math.max(0, Math.min(1, shot.power)) * 0.030;
    cue.vx = (shot.dx / len) * speed; cue.vy = (shot.dy / len) * speed;
    popSound();
    setAnimating(true);
    cancelAnimationFrame(animRef.current);
    let steps = 0;
    const loop = () => {
      let moving = false;
      for (let k = 0; k < 5; k++) { moving = stepBalls(balls); steps++; if (!moving) break; }
      render(balls, null);
      if (moving && steps < 4200) { animRef.current = requestAnimationFrame(loop); }
      else {
        setAnimating(false);
        render(g.balls, null);
        const potted = g.balls.filter((b) => b.pocketed).length;
        if (potted > pottedCount.current) boomSound();
        pottedCount.current = potted;
      }
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [g.lastShot?.seq, g.balls]);

  // Visée affichée : la mienne (avec la puissance du curseur) à mon tour,
  // celle de l'adversaire (relayée en direct) pendant le sien.
  const shownAim = g.isMyTurn ? (aim ? { ...aim, power } : null) : oppAim;

  useEffect(() => { if (!animating) render(g.balls, shownAim); }, [aim, power, oppAim, g.isMyTurn, animating, g.phase, vertical]);

  // Écran (px canvas) -> coordonnées table, selon l'orientation.
  function tablePoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const w = vertical ? CH : CW, h = vertical ? CW : CH;
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const py = ((e.clientY - rect.top) / rect.height) * h;
    const hx = vertical ? py : px;            // inverse de la rotation 90°
    const hy = vertical ? CH - px : py;
    return {
      x: ((hx - PAD) / (CW - 2 * PAD)) * TABLE.W,
      y: ((hy - PAD) / (CH - 2 * PAD)) * TABLE.H,
    };
  }

  // Visée façon Plato : toucher/glisser sur la table ORIENTE la flèche
  // (direction = de la blanche vers le doigt). La puissance, c'est le curseur.
  function pointAt(e) {
    if (!g.isMyTurn || animating || g.phase !== 'playing') return;
    const p = tablePoint(e);
    const cue = g.balls.find((b) => b.id === 0);
    if (!cue) return;
    const dx = p.x - cue.x, dy = p.y - cue.y;
    if (Math.sqrt(dx * dx + dy * dy) < 0.02) return; // trop près de la bille
    const a = { dx, dy };
    setAim(a);
    emitAim(a, power);
  }
  function onDown(e) {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* simulé */ }
    pointAt(e);
  }

  // Curseur de puissance (gauche) : plus on descend, plus c'est fort.
  // On relâche pour tirer.
  function sliderPower(e) {
    const r = sliderRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  }
  function sliderDown(e) {
    if (!g.isMyTurn || animating || !aim) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* simulé */ }
    slidingRef.current = true;
    const p = sliderPower(e);
    setPower(p);
    emitAim(aim, p);
  }
  function sliderMove(e) {
    if (!slidingRef.current) return;
    const p = sliderPower(e);
    setPower(p);
    emitAim(aim, p);
  }
  function sliderUp() {
    if (!slidingRef.current) return;
    slidingRef.current = false;
    if (aim && power > 0.05) {
      onAction({ kind: 'shoot', dx: aim.dx, dy: aim.dy, power });
    }
    setPower(0);
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Target size={20} color="#2e8f5b" /> Billard — salle d'attente</h3>
        <p className="cn-hint-text">Le 8-ball classique en face à face. Le premier empochage attribue votre groupe — billes pleines ou rayées. Videz votre groupe, puis empochez la noire pour gagner ; la faire tomber trop tôt, c'est perdre. Touchez la table pour viser (la flèche sur la blanche montre la direction), puis tirez le curseur de gauche vers le bas — plus c'est bas, plus c'est fort — et relâchez pour tirer. 2 joueuses.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            </div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre la partie</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'une adversaire…</p>}
      </div>
    );
  }

  const groupLabel = (grp) => (grp === 'solid' ? 'Pleines' : grp === 'stripe' ? 'Rayées' : 'À définir');
  // Les billes qu'il reste à empocher pour une joueuse (puis la 8 quand le groupe est vidé).
  const ballsFor = (id) => {
    const grp = g.groups[id];
    if (!grp) return null;
    const rest = g.remaining[grp];
    return rest.length ? rest : (g.remaining.eight ? [8] : []);
  };
  // L'animation d'abord : on ne révèle pas la fin avant que les billes s'arrêtent.
  const banner = animating ? null
    : g.phase === 'over'
      ? (g.winner === me ? 'Tu gagnes la partie !' : `${nameById[g.winner] || '?'} gagne la partie !`)
      : g.isMyTurn
        ? (power > 0.02 ? `Puissance ${Math.round(power * 100)} % — relâche pour tirer !` : 'Touche la table pour viser, puis tire le curseur vers le bas')
        : `${nameById[g.turn] || '?'} vise…`;

  return (
    <div className="pool fade-up">
      {banner && <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>}

      <div className="pool-players">
        {g.seats.map((id) => {
          const rest = ballsFor(id);
          return (
            <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}>
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
              {rest === null
                ? <b>{groupLabel(null)}</b>
                : <span className="pool-chip-balls">
                    {rest.map((bid) => (
                      <span key={bid} className={`pool-mini ${isStripe(bid) ? 'stripe' : ''} ${bid === 8 ? 'eight' : ''}`}
                        style={{ '--bc': colorOf(bid) }}>{bid}</span>
                    ))}
                  </span>}
            </div>
          );
        })}
      </div>

      <div className="pool-stage">
        {g.phase === 'playing' && g.isMyTurn && !animating && (
          <div className="pool-power" ref={sliderRef}
            onPointerDown={sliderDown} onPointerMove={sliderMove} onPointerUp={sliderUp} onPointerCancel={sliderUp}>
            <div className="pool-power-fill" style={{ height: `${power * 100}%` }} />
            <span className="pool-power-hint">💪</span>
          </div>
        )}
        <div className={`pool-table-wrap ${vertical ? 'vertical' : ''}`}>
          <canvas ref={canvasRef}
            width={vertical ? CH : CW} height={vertical ? CW : CH}
            className={`pool-canvas ${g.isMyTurn && !animating ? 'aiming' : ''}`}
            onPointerDown={onDown} onPointerMove={(e) => { if (e.buttons) pointAt(e); }} />
        </div>
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

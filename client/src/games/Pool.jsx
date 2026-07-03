import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Target } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
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

  // Visée « lance-pierre » : ligne de tir + queue en arrière + jauge.
  if (aim && cue && !cue.pocketed && aim.power > 0.02) {
    const len = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy) || 1;
    const ux = aim.dx / len, uy = aim.dy / len;
    // ligne de tir (longueur selon puissance)
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx(cue.x), ly(cue.y));
    ctx.lineTo(lx(cue.x + ux * (0.22 + aim.power * 0.75)), ly(cue.y + uy * (0.22 + aim.power * 0.75)));
    ctx.stroke();
    ctx.setLineDash([]);
    // queue de billard tirée en arrière
    const back = 0.06 + aim.power * 0.16;
    ctx.strokeStyle = '#caa06a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx(cue.x - ux * (0.045 + back * 0.2)), ly(cue.y - uy * (0.045 + back * 0.2)));
    ctx.lineTo(lx(cue.x - ux * (0.045 + back)), ly(cue.y - uy * (0.045 + back)));
    ctx.stroke();
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
  const dragRef = useRef(null); // { x, y } point de départ du glisser (coords table)
  const [aim, setAim] = useState(null); // { dx, dy, power }
  const [animating, setAnimating] = useState(false);
  const [vertical, setVertical] = useState(typeof window !== 'undefined' && window.innerWidth < 700);
  const lastShotSeq = useRef(g.lastShot?.seq || 0);
  const pottedCount = useRef(g.balls?.filter((b) => b.pocketed).length || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { if (g.phase === 'over' && g.winner === me) { winConfetti(); boomSound(true); } }, [g.phase]);
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
      if (!animating) render(g.balls, aim);
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

  useEffect(() => { if (!animating) render(g.balls, aim); }, [aim, g.isMyTurn, animating, g.phase, vertical]);

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

  // Tir « lance-pierre » : on pose le doigt, on tire EN ARRIÈRE pour doser la
  // puissance (la queue se bande), on relâche pour tirer.
  function onDown(e) {
    if (!g.isMyTurn || animating || g.phase !== 'playing') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = tablePoint(e);
    setAim({ dx: 0, dy: 0, power: 0 });
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const p = tablePoint(e);
    const dx = dragRef.current.x - p.x;   // direction opposée au glisser
    const dy = dragRef.current.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setAim({ dx, dy, power: Math.min(1, dist / 0.5) });
  }
  function onUp() {
    const a = aim;
    dragRef.current = null;
    if (a && a.power > 0.06) {
      onAction({ kind: 'shoot', dx: a.dx, dy: a.dy, power: a.power });
    }
    setAim(null);
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Target size={20} color="#2e8f5b" /> Billard — salle d'attente</h3>
        <p className="cn-hint-text">Le 8-ball classique en face à face. Le premier empochage attribue votre groupe — billes pleines ou rayées. Videz votre groupe, puis empochez la noire pour gagner ; la faire tomber trop tôt, c'est perdre. Posez le doigt sur la table, tirez vers l'arrière pour doser la puissance, relâchez pour jouer. 2 joueuses.</p>
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
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}
        </div>
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
  const banner = g.phase === 'over'
    ? (g.winner === me ? 'Tu gagnes la partie !' : `${nameById[g.winner] || '?'} gagne la partie !`)
    : animating ? 'Les billes roulent…'
      : g.isMyTurn
        ? (aim && aim.power > 0.02 ? `Puissance ${Math.round(aim.power * 100)} % — relâche pour tirer` : 'Pose le doigt et tire vers l\'arrière pour viser')
        : `Au tour de ${nameById[g.turn] || '?'}…`;

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

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

      <div className={`pool-table-wrap ${vertical ? 'vertical' : ''}`}>
        <canvas ref={canvasRef}
          width={vertical ? CH : CW} height={vertical ? CW : CH}
          className={`pool-canvas ${g.isMyTurn && !animating ? 'aiming' : ''}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

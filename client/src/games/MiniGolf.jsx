import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Flag } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { getSocket } from '../socket.js';
import { winConfetti, popSound, boomSound } from '../effects.js';
import botAvatar from '../assets/chatgpt.png';

// ---- Physique locale : COPIE de server/games/minigolf.js (garder synchronisé).
// Le serveur reste l'autorité : on anime localement le même coup, puis on se
// cale sur les positions finales envoyées par le serveur.
const COURSE = { W: 1, H: 1.6, R: 0.022, HOLE_R: 0.034 };
const FRICTION = 0.9915, SAND_FRICTION = 0.955, STOP = 0.00025, CUSHION = 0.88;
const CAPTURE_SPEED = 0.02, SUBSTEPS = 6;
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function bounceWalls(layout, b) {
  const { R } = COURSE;
  for (const w of layout.walls) {
    const nx = Math.max(w.x, Math.min(b.x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(b.y, w.y + w.h));
    const dx = b.x - nx, dy = b.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    if (dx === 0 && dy === 0) {
      const pl = b.x - w.x, pr = w.x + w.w - b.x, pt = b.y - w.y, pb = w.y + w.h - b.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) { b.x = w.x - R; if (b.vx > 0) b.vx = -b.vx * CUSHION; }
      else if (m === pr) { b.x = w.x + w.w + R; if (b.vx < 0) b.vx = -b.vx * CUSHION; }
      else if (m === pt) { b.y = w.y - R; if (b.vy > 0) b.vy = -b.vy * CUSHION; }
      else { b.y = w.y + w.h + R; if (b.vy < 0) b.vy = -b.vy * CUSHION; }
    } else {
      const d = Math.sqrt(d2) || 1e-9;
      const ux = dx / d, uy = dy / d;
      b.x = nx + ux * R; b.y = ny + uy * R;
      const vn = b.vx * ux + b.vy * uy;
      if (vn < 0) { b.vx -= (1 + CUSHION) * vn * ux; b.vy -= (1 + CUSHION) * vn * uy; }
    }
  }
}

// Un pas de simulation (renvoie 'holed' | 'moving' | 'stopped').
function stepBall(layout, b) {
  const { W, H, R, HOLE_R } = COURSE;
  for (let ss = 0; ss < SUBSTEPS; ss++) {
    b.x += b.vx / SUBSTEPS; b.y += b.vy / SUBSTEPS;
    bounceWalls(layout, b);
    if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx * CUSHION; }
    if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx * CUSHION; }
    if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy * CUSHION; }
    if (b.y > H - R && b.vy > 0) { b.y = H - R; b.vy = -b.vy * CUSHION; }
    const hx = b.x - layout.hole[0], hy = b.y - layout.hole[1];
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (hx * hx + hy * hy < HOLE_R * HOLE_R && sp < CAPTURE_SPEED) {
      b.x = layout.hole[0]; b.y = layout.hole[1]; b.vx = 0; b.vy = 0;
      return 'holed';
    }
  }
  let f = FRICTION;
  for (const s of layout.sand) if (inRect(b.x, b.y, s)) { f *= SAND_FRICTION; break; }
  b.vx *= f; b.vy *= f;
  if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < STOP) { b.vx = 0; b.vy = 0; return 'stopped'; }
  return 'moving';
}

// Trajectoire prévisionnelle : segments réfléchis sur murs et bandes (approche
// rayon contre rectangles gonflés de R — même géométrie que la vraie physique).
function castGolf(layout, ox, oy, ux, uy) {
  const { W, H, R } = COURSE;
  let t = Infinity, nx = 0, ny = 0;
  const consider = (tt, nxx, nyy) => { if (tt > 1e-6 && tt < t) { t = tt; nx = nxx; ny = nyy; } };
  if (ux < 0) consider((R - ox) / ux, 1, 0);
  if (ux > 0) consider((W - R - ox) / ux, -1, 0);
  if (uy < 0) consider((R - oy) / uy, 0, 1);
  if (uy > 0) consider((H - R - oy) / uy, 0, -1);
  for (const w of layout.walls) {
    const x0 = w.x - R, x1 = w.x + w.w + R, y0 = w.y - R, y1 = w.y + w.h + R;
    if (ux > 0 && ox <= x0) { const tt = (x0 - ox) / ux; const y = oy + uy * tt; if (y > y0 && y < y1) consider(tt, -1, 0); }
    if (ux < 0 && ox >= x1) { const tt = (x1 - ox) / ux; const y = oy + uy * tt; if (y > y0 && y < y1) consider(tt, 1, 0); }
    if (uy > 0 && oy <= y0) { const tt = (y0 - oy) / uy; const x = ox + ux * tt; if (x > x0 && x < x1) consider(tt, 0, -1); }
    if (uy < 0 && oy >= y1) { const tt = (y1 - oy) / uy; const x = ox + ux * tt; if (x > x0 && x < x1) consider(tt, 0, 1); }
  }
  return { t: Number.isFinite(t) ? t : 0.1, nx, ny };
}

const SEAT_COLORS = ['#e0392e', '#2b5fd4', '#f2c11f', '#2e9c5c', '#8c44c9', '#f28322'];

// Espace canvas : parcours vertical 1×1,6 à l'échelle 440 px + cadre.
const PAD = 10, SCALE = 440;
const CW = SCALE + 2 * PAD, CH = Math.round(SCALE * COURSE.H) + 2 * PAD;
const lx = (x) => PAD + x * SCALE;
const ly = (y) => PAD + y * SCALE;
const lr = (r) => r * SCALE;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawScene(ctx, layout, balls, seats, me, aim, colorsBySeat) {
  ctx.clearRect(0, 0, CW, CH);
  // cadre + gazon
  ctx.fillStyle = '#6d4326';
  roundRect(ctx, 0, 0, CW, CH, 16); ctx.fill();
  const grass = ctx.createRadialGradient(CW / 2, CH / 2, 80, CW / 2, CH / 2, CH / 1.4);
  grass.addColorStop(0, '#3fa763'); grass.addColorStop(1, '#2c7f4c');
  ctx.fillStyle = grass;
  roundRect(ctx, PAD - 4, PAD - 4, CW - 2 * (PAD - 4), CH - 2 * (PAD - 4), 10); ctx.fill();

  // sable
  for (const s of layout.sand) {
    ctx.fillStyle = '#e8d59a';
    roundRect(ctx, lx(s.x), ly(s.y), lr(s.w), lr(s.h), 12); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(lx(s.x + s.w * (0.25 + 0.25 * i)), ly(s.y + s.h * (0.3 + 0.2 * (i % 2))), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // départ (petit tapis)
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(lx(layout.start[0]), ly(layout.start[1]), lr(COURSE.R) + 6, 0, Math.PI * 2); ctx.fill();

  // trou + drapeau
  const hx = lx(layout.hole[0]), hy = ly(layout.hole[1]);
  ctx.beginPath(); ctx.arc(hx, hy, lr(COURSE.HOLE_R), 0, Math.PI * 2);
  ctx.fillStyle = '#14161a'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#f6f2ea'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - 34); ctx.stroke();
  ctx.fillStyle = '#e0392e';
  ctx.beginPath(); ctx.moveTo(hx, hy - 34); ctx.lineTo(hx + 18, hy - 27); ctx.lineTo(hx, hy - 20); ctx.closePath(); ctx.fill();

  // murs
  for (const w of layout.walls) {
    ctx.fillStyle = '#7a4b2a';
    roundRect(ctx, lx(w.x), ly(w.y), lr(w.w), lr(w.h), 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, lx(w.x), ly(w.y), lr(w.w), Math.min(5, lr(w.h)), 6); ctx.fill();
  }

  // visée : pointillés avec rebonds + flèche
  if (aim && (aim.dx || aim.dy)) {
    const from = balls[aim.by] || null;
    if (from && !from.done) {
      const len = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy) || 1;
      let ux = aim.dx / len, uy = aim.dy / len;
      let px = from.x, py = from.y;
      // Longueur totale de l'aperçu proportionnelle à la puissance.
      let reach = 0.25 + (aim.power || 0) * 0.9;
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let seg = 0; seg < 3 && reach > 0.01; seg++) {
        const hit = castGolf(layout, px, py, ux, uy);
        const d = Math.min(hit.t, reach);
        const ex = px + ux * d, ey = py + uy * d;
        ctx.beginPath(); ctx.moveTo(lx(px), ly(py)); ctx.lineTo(lx(ex), ly(ey)); ctx.stroke();
        reach -= d;
        if (d < hit.t) { px = ex; py = ey; break; }
        // réflexion sur la normale du mur touché
        if (hit.nx) ux = -ux;
        if (hit.ny) uy = -uy;
        px = ex; py = ey;
      }
      ctx.setLineDash([]);
      // pointe de flèche au bout
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(lx(px), ly(py), 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // balles : la mienne opaque et cerclée, les autres translucides (fantômes)
  for (const id of seats) {
    const b = balls[id];
    if (!b || b.done) continue;
    const X = lx(b.x), Y = ly(b.y), Rp = lr(COURSE.R);
    ctx.globalAlpha = id === me ? 1 : 0.55;
    const col = colorsBySeat[id] || '#f6f2ea';
    const grad = ctx.createRadialGradient(X - Rp * 0.4, Y - Rp * 0.45, Rp * 0.2, X, Y, Rp);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, col); grad.addColorStop(1, col);
    ctx.beginPath(); ctx.arc(X, Y, Rp, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    if (id === me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

export default function MiniGolf({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;
  const colorsBySeat = Object.fromEntries(g.seats.map((id, i) => [id, SEAT_COLORS[i % SEAT_COLORS.length]]));

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dragRef = useRef(null);
  const lastEmitRef = useRef(0);
  const aimRef = useRef(null);               // dernière visée (les états React arrivent trop tard sur un flick rapide)
  const [aim, setAim] = useState(null);      // { dx, dy, power } pendant le glisser
  const [oppAim, setOppAim] = useState(null);
  const [animating, setAnimating] = useState(false);
  const lastShotSeq = useRef(g.lastShot?.seq || 0);
  const animBalls = useRef(null); // positions animées pendant le replay

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && !animating && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase, animating]);

  // Visée des autres relayée en direct.
  useEffect(() => {
    const s = getSocket();
    const onAim = (a) => setOppAim(a && Number.isFinite(a.dx) ? a : null);
    s.on('golf:aim', onAim);
    return () => s.off('golf:aim', onAim);
  }, []);
  useEffect(() => { setOppAim(null); }, [g.turn, g.lastShot?.seq]);

  function emitAim(a) {
    const now = Date.now();
    if (now - lastEmitRef.current < 90) return;
    lastEmitRef.current = now;
    getSocket().emit('golf:aim', a);
  }

  const render = (balls, aimLine) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawScene(ctx, g.layout, balls, g.seats, me, aimLine, colorsBySeat);
  };

  // Nouveau coup : rejoue la simulation localement pour l'animation.
  useEffect(() => {
    const shot = g.lastShot;
    if (!shot || shot.seq === lastShotSeq.current) return;
    lastShotSeq.current = shot.seq;
    if (!shot.from) return;
    const ball = { x: shot.from.x, y: shot.from.y, vx: 0, vy: 0 };
    const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
    const speed = 0.006 + Math.max(0, Math.min(1, shot.power)) * 0.030;
    ball.vx = (shot.dx / len) * speed; ball.vy = (shot.dy / len) * speed;
    popSound();
    setAnimating(true);
    cancelAnimationFrame(animRef.current);
    let steps = 0;
    const loop = () => {
      let status = 'stopped';
      for (let k = 0; k < 5; k++) { status = stepBall(g.layout, ball); steps++; if (status !== 'moving') break; }
      const balls = { ...g.balls, [shot.by]: { ...g.balls[shot.by], x: ball.x, y: ball.y, done: false } };
      animBalls.current = balls;
      render(balls, null);
      if (status === 'moving' && steps < 3000) { animRef.current = requestAnimationFrame(loop); }
      else {
        if (status === 'holed' || shot.holed) boomSound();
        setAnimating(false);
        animBalls.current = null;
        render(g.balls, null);
      }
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [g.lastShot?.seq]);

  // Visée affichée : la mienne, ou celle relayée de l'adversaire / du bot.
  const shownAim = g.isMyTurn
    ? (aim ? { ...aim, by: me } : null)
    : (oppAim ? { ...oppAim, by: g.turn } : g.botAim ? { ...g.botAim, by: 'bot', power: g.botAim.power } : null);

  useEffect(() => {
    if (!animating) render(animBalls.current || g.balls, shownAim);
  }, [aim, oppAim, g.botAim, g.balls, g.turn, g.isMyTurn, animating, g.hole, g.phase]);

  function tablePoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CW / SCALE - PAD / SCALE,
      y: ((e.clientY - rect.top) / rect.height) * CH / SCALE - PAD / SCALE,
    };
  }

  // Visée au doigt : on touche n'importe où et on glisse — la flèche part de la
  // balle vers le doigt, la distance donne la puissance. On relâche pour tirer.
  function onDown(e) {
    if (!g.isMyTurn || animating || g.phase !== 'playing') return;
    const b = g.balls[me];
    if (!b || b.done) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* simulé */ }
    dragRef.current = true;
    onMove(e);
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const p = tablePoint(e);
    const b = g.balls[me];
    const dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01) return;
    const power = Math.max(0, Math.min(1, (d - 0.05) / 0.55));
    const a = { dx, dy, power };
    aimRef.current = a;
    setAim(a);
    emitAim({ dx, dy, power, by: me });
  }
  function onUp() {
    if (!dragRef.current) return;
    dragRef.current = false;
    const a = aimRef.current;
    if (a && a.power > 0.05) {
      onAction({ kind: 'shoot', dx: a.dx, dy: a.dy, power: a.power });
    }
    aimRef.current = null;
    setAim(null);
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Flag size={20} color="#2e8f5b" /> Mini Golf — salle d'attente</h3>
        <p className="cn-hint-text">6 trous, le moins de coups possible ! Touche l'écran et glisse pour viser : la flèche montre la trajectoire (rebonds compris), plus tu éloignes le doigt, plus le coup est fort. Relâche pour tirer. Les balles des autres sont des fantômes : elles ne gênent pas la tienne. 2 à 6 joueuses.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}</span>
            </div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre la partie</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}
          {g.amSeated && !g.seats.includes('bot') && g.seats.length < 6 && <Button variant="outlined" color="secondary" onClick={() => onAction({ kind: 'bot' })}>Inviter ChatGPT</Button>}
        </div>
        {g.amSeated && g.seats.length < 2 && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const banner = g.phase === 'over'
    ? (g.winners?.includes(me) ? 'Tu gagnes la partie !' : `${(g.winners || []).map((id) => nameById[id] || '?').join(' & ')} gagne la partie !`)
    : g.onBreak
      ? `Fin du trou ${g.hole + 1} — au suivant !`
      : g.isMyTurn
        ? (aim && aim.power > 0.02 ? `Puissance ${Math.round(aim.power * 100)} % — relâche pour tirer !` : 'Touche et glisse pour viser, relâche pour tirer')
        : `${nameById[g.turn] || '?'} joue…`;

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="pool-players">
        {g.seats.map((id) => (
          <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}
            style={{ borderColor: colorsBySeat[id] }}>
            <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
            <span>{nameById[id] || '?'}</span>
            <b style={{ color: colorsBySeat[id] }}>{g.totals[id] + (g.balls[id]?.strokes || 0)}</b>
            {g.balls[id]?.done && <span>⛳</span>}
          </div>
        ))}
      </div>

      <div className="pool-stage" style={{ justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)', marginBottom: 6 }}>
            Trou {g.hole + 1}/{g.holeCount} · {g.layout.name} · Par {g.layout.par} · {g.balls[me] ? `${g.balls[me].strokes} coup${g.balls[me].strokes > 1 ? 's' : ''}` : ''}
          </div>
          <canvas ref={canvasRef} width={CW} height={CH}
            style={{ width: '100%', display: 'block', borderRadius: 16, touchAction: 'none', cursor: g.isMyTurn ? 'crosshair' : 'default' }}
            onPointerDown={onDown} onPointerMove={onMove}
            onPointerUp={onUp} onPointerCancel={onUp} />

          {/* Tableau des scores pendant la pause entre deux trous et à la fin */}
          {(g.onBreak || (g.phase === 'over' && !animating)) && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10,14,12,0.55)', borderRadius: 16,
            }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', minWidth: 220, boxShadow: 'var(--shadow)' }}>
                <h4 style={{ margin: '0 0 8px', textAlign: 'center' }}>Scores</h4>
                {g.seats
                  .slice()
                  .sort((a, b) => (g.totals[a] + (g.balls[a]?.strokes || 0)) - (g.totals[b] + (g.balls[b]?.strokes || 0)))
                  .map((id) => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, background: colorsBySeat[id] }} />
                      <span style={{ flex: 1 }}>{nameById[id] || '?'}</span>
                      <b>{g.totals[id] + (g.balls[id]?.strokes || 0)}</b>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

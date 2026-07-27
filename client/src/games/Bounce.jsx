import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Circle } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';
import botAvatar from '../assets/chatgpt.png';

// ---- Physique locale : COPIE de server/games/bounce.js (garder synchronisé).
const BOARD = { W: 1, H: 1.3, COLS: 7, R: 0.016, TOP: 0.06, CELL_H: 0.078, MAX_ROWS: 13, LAUNCH_Y: 1.22 };
const CELL_W = BOARD.W / BOARD.COLS;
const SPEED = 0.02, SUBSTEPS = 2, STAGGER = 9;

const brickRect = (i, c) => ({
  x: c * CELL_W + 0.004,
  y: BOARD.TOP + i * BOARD.CELL_H + 0.004,
  w: CELL_W - 0.008,
  h: BOARD.CELL_H - 0.008,
});

// Volée pas-à-pas pour l'animation (même logique que le serveur).
function makeVolley(grid, ballCount, launchX, dir) {
  const { W, R, LAUNCH_Y } = BOARD;
  const len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) || 1;
  let ux = dir.dx / len, uy = dir.dy / len;
  if (uy > -0.12) { uy = -0.12; const s = Math.sqrt(1 - uy * uy); ux = Math.sign(ux || 1) * s; }
  const balls = [];
  for (let k = 0; k < ballCount; k++) {
    balls.push({ x: launchX, y: LAUNCH_Y, vx: ux * SPEED, vy: uy * SPEED, wait: k * STAGGER, out: false });
  }
  let steps = 0;
  return {
    balls, grid,
    step() {
      steps++;
      let alive = false; let broke = false;
      for (const b of balls) {
        if (b.out) continue;
        if (b.wait > 0) { b.wait--; alive = true; continue; }
        alive = true;
        for (let ss = 0; ss < SUBSTEPS; ss++) {
          b.x += b.vx / SUBSTEPS; b.y += b.vy / SUBSTEPS;
          if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx; }
          if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx; }
          if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy; }
          if (b.y > LAUNCH_Y + 0.02 && b.vy > 0) { b.out = true; break; }
          const ci = Math.floor((b.y - BOARD.TOP) / BOARD.CELL_H);
          const cc = Math.floor(b.x / CELL_W);
          for (let i = ci - 1; i <= ci + 1; i++) {
            if (i < 0 || i >= grid.length) continue;
            for (let c = cc - 1; c <= cc + 1; c++) {
              if (c < 0 || c >= BOARD.COLS) continue;
              const cell = grid[i][c];
              if (!cell) continue;
              const rct = brickRect(i, c);
              const nx = Math.max(rct.x, Math.min(b.x, rct.x + rct.w));
              const ny = Math.max(rct.y, Math.min(b.y, rct.y + rct.h));
              const dx = b.x - nx, dy = b.y - ny;
              if (dx * dx + dy * dy >= R * R) continue;
              if (cell.ball) { grid[i][c] = null; continue; }
              if (dx === 0 && dy === 0) { b.vy = -b.vy; }
              else if (Math.abs(dx) > Math.abs(dy)) {
                b.x = nx + Math.sign(dx) * R;
                if (Math.sign(b.vx) !== Math.sign(dx)) b.vx = -b.vx;
              } else {
                b.y = ny + Math.sign(dy) * R;
                if (Math.sign(b.vy) !== Math.sign(dy)) b.vy = -b.vy;
              }
              cell.hp -= 1;
              if (cell.hp <= 0) { grid[i][c] = null; broke = true; }
            }
          }
        }
      }
      return { alive: alive && steps < 9000, broke };
    },
  };
}

// Couleur d'une brique selon ses points de vie (chaud = costaud).
function brickColor(hp) {
  const tiers = ['#4cc9f0', '#43aa8b', '#f9c74f', '#f8961e', '#f3722c', '#e0392e', '#b5179e', '#7209b7'];
  return tiers[Math.min(tiers.length - 1, Math.floor(Math.log2(Math.max(1, hp))))];
}

const PAD = 8, SCALE = 420;
const CW = SCALE + 2 * PAD, CH = Math.round(SCALE * BOARD.H) + 2 * PAD;
const lx = (x) => PAD + x * SCALE;
const ly = (y) => PAD + y * SCALE;

function drawBoard(ctx, grid, balls, launchX, aim, ballCount) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = '#171a26';
  ctx.beginPath(); ctx.roundRect(0, 0, CW, CH, 14); ctx.fill();
  // ligne de mort
  ctx.strokeStyle = 'rgba(224,57,46,0.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, ly(BOARD.TOP + BOARD.MAX_ROWS * BOARD.CELL_H)); ctx.lineTo(CW - PAD, ly(BOARD.TOP + BOARD.MAX_ROWS * BOARD.CELL_H)); ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < grid.length; i++) {
    for (let c = 0; c < BOARD.COLS; c++) {
      const cell = grid[i][c];
      if (!cell) continue;
      const r = brickRect(i, c);
      if (cell.ball) {
        ctx.fillStyle = '#f6f2ea';
        ctx.beginPath(); ctx.arc(lx(r.x + r.w / 2), ly(r.y + r.h / 2), 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2c11f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(lx(r.x + r.w / 2), ly(r.y + r.h / 2), 12, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.fillStyle = brickColor(cell.hp);
      ctx.beginPath(); ctx.roundRect(lx(r.x), ly(r.y), r.w * SCALE, r.h * SCALE, 6); ctx.fill();
      ctx.fillStyle = '#14161a';
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.hp), lx(r.x + r.w / 2), ly(r.y + r.h / 2) + 1);
    }
  }

  // guide de visée : premier trajet en pointillés
  if (aim) {
    const len = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy) || 1;
    let ux = aim.dx / len, uy = aim.dy / len;
    if (uy > -0.12) { uy = -0.12; const s = Math.sqrt(1 - uy * uy); ux = Math.sign(ux || 1) * s; }
    ctx.setLineDash([3, 12]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    // avance un point virtuel jusqu'au premier contact (mur/brique) puis un rebond
    let px = launchX, py = BOARD.LAUNCH_Y, dx = ux, dy = uy;
    for (let seg = 0; seg < 2; seg++) {
      let x = px, y = py; let hit = null;
      for (let t = 0; t < 2000; t++) {
        x += dx * 0.004; y += dy * 0.004;
        if (x < BOARD.R || x > BOARD.W - BOARD.R) { hit = 'v'; break; }
        if (y < BOARD.R) { hit = 'h'; break; }
        const i = Math.floor((y - BOARD.TOP) / BOARD.CELL_H), c = Math.floor(x / CELL_W);
        if (i >= 0 && i < grid.length && c >= 0 && c < BOARD.COLS && grid[i][c] && !grid[i][c].ball) { hit = 'b'; break; }
      }
      ctx.beginPath(); ctx.moveTo(lx(px), ly(py)); ctx.lineTo(lx(x), ly(y)); ctx.stroke();
      if (hit !== 'v' && hit !== 'h') break;
      if (hit === 'v') dx = -dx; else dy = -dy;
      px = x; py = y;
    }
    ctx.setLineDash([]);
  }

  // balles en vol
  if (balls) {
    ctx.fillStyle = '#f6f2ea';
    for (const b of balls) {
      if (b.out || b.wait > 0) continue;
      ctx.beginPath(); ctx.arc(lx(b.x), ly(b.y), BOARD.R * SCALE, 0, Math.PI * 2); ctx.fill();
    }
  }

  // lanceur + nombre de balles
  ctx.fillStyle = '#f6f2ea';
  ctx.beginPath(); ctx.arc(lx(launchX), ly(BOARD.LAUNCH_Y), 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`×${ballCount}`, lx(launchX), ly(BOARD.LAUNCH_Y) + 20);
}

// Mini plateau adversaire (aperçu).
function MiniBoard({ grid, alive }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = 84, h = 110;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = alive ? '#171a26' : '#3a1d20';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 6); ctx.fill();
    const cw = w / BOARD.COLS, ch = (h - 8) / (BOARD.MAX_ROWS + 1);
    for (let i = 0; i < grid.length; i++) {
      for (let c = 0; c < BOARD.COLS; c++) {
        const cell = grid[i][c];
        if (!cell) continue;
        if (cell.ball) { ctx.fillStyle = '#f6f2ea'; ctx.fillRect(c * cw + cw / 2 - 1.5, 4 + i * ch + ch / 2 - 1.5, 3, 3); continue; }
        ctx.fillStyle = brickColor(cell.hp);
        ctx.fillRect(c * cw + 1, 4 + i * ch + 1, cw - 2, ch - 2);
      }
    }
  }, [grid, alive]);
  return <canvas ref={ref} width={84} height={110} style={{ borderRadius: 6, opacity: alive ? 1 : 0.55 }} />;
}

export default function Bounce({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dragRef = useRef(false);
  const aimRef = useRef(null); // dernière visée (l'état React arrive trop tard sur un flick rapide)
  const [aim, setAim] = useState(null);
  const [animating, setAnimating] = useState(false);
  const lastShotSeq = useRef(g.me?.lastShot?.seq || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase]);

  const render = (grid, balls, launchX, aimLine, count) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawBoard(ctx, grid, balls, launchX, aimLine, count);
  };

  // Rejoue ma volée pour l'animation, puis se cale sur l'état serveur.
  useEffect(() => {
    const shot = g.me?.lastShot;
    if (!shot || shot.seq === lastShotSeq.current) return;
    lastShotSeq.current = shot.seq;
    if (!shot.grid) return;
    const grid = shot.grid.map((row) => row.map((c) => (c ? { ...c } : null)));
    const volley = makeVolley(grid, shot.balls, shot.from, { dx: shot.dx, dy: shot.dy });
    popSound();
    setAnimating(true);
    cancelAnimationFrame(animRef.current);
    const loop = () => {
      let st = { alive: false, broke: false };
      for (let k = 0; k < 4; k++) { st = volley.step(); if (!st.alive) break; }
      if (st.broke) popSound();
      render(grid, volley.balls, shot.from, null, shot.balls);
      if (st.alive) { animRef.current = requestAnimationFrame(loop); }
      else {
        setAnimating(false);
        if (g.me) render(g.me.grid, null, g.me.launchX, null, g.me.balls);
      }
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [g.me?.lastShot?.seq]);

  useEffect(() => {
    if (!animating && g.me) render(g.me.grid, null, g.me.launchX, aim, g.me.balls);
  }, [g.me?.grid, g.me?.launchX, aim, animating, g.phase]);

  function boardPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (((e.clientX - rect.left) / rect.width) * CW - PAD) / SCALE,
      y: (((e.clientY - rect.top) / rect.height) * CH - PAD) / SCALE,
    };
  }
  function onDown(e) {
    if (!g.me?.alive || animating || g.phase !== 'playing') return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* simulé */ }
    dragRef.current = true;
    onMove(e);
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const p = boardPoint(e);
    const dx = p.x - g.me.launchX, dy = p.y - BOARD.LAUNCH_Y;
    if (dy > -0.02) return; // on vise vers le haut
    aimRef.current = { dx, dy };
    setAim({ dx, dy });
  }
  function onUp() {
    if (!dragRef.current) return;
    dragRef.current = false;
    const a = aimRef.current;
    if (a && a.dy < -0.02) onAction({ kind: 'shoot', dx: a.dx, dy: a.dy });
    aimRef.current = null;
    setAim(null);
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Circle size={20} color="#4cc9f0" /> Bounce — salle d'attente</h3>
        <p className="cn-hint-text">Casse-briques à volées de balles ! Chaque brique encaisse son numéro de coups. Après chaque tir, les briques descendent : si une brique touche le bas, tu es éliminée. Ramasse les balles bonus pour agrandir ta volée. Tout le monde a les mêmes briques — la dernière survivante gagne. Touche et glisse pour viser, relâche pour tirer. 2 à 6 joueuses.</p>
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
    : !g.me?.alive
      ? 'Éliminée ! Regarde les autres finir…'
      : (aim ? 'Relâche pour tirer !' : `Manche ${g.me?.round} — touche et glisse pour viser`);

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.me?.alive && g.phase === 'playing' ? 'mine' : ''}`}>{banner}</div>

      <div className="pool-players">
        {g.seats.filter((id) => id !== me).map((id) => {
          const o = g.others[id] || {};
          return (
            <div key={id} className="pool-chip" style={{ flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={22} />
                <span>{nameById[id] || '?'}</span>
                <b>M{o.round}</b>
              </div>
              <MiniBoard grid={o.grid || []} alive={o.alive} />
            </div>
          );
        })}
      </div>

      <div className="pool-stage" style={{ justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)', marginBottom: 6 }}>
            Manche {g.me?.round} · {g.me?.bricks} briques · ×{g.me?.balls} balles
          </div>
          <canvas ref={canvasRef} width={CW} height={CH}
            style={{ width: '100%', display: 'block', borderRadius: 14, touchAction: 'none', cursor: g.me?.alive ? 'crosshair' : 'default' }}
            onPointerDown={onDown} onPointerMove={onMove}
            onPointerUp={onUp} onPointerCancel={onUp} />
        </div>
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

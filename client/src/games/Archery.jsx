import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Target, Wind } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

// ---- Mêmes constantes que server/games/archery.js (garder synchronisé). ----
const FIELD = { W: 1, H: 1.5 };
const BOW = { x: 0.5, y: 1.32 };
const TARGET = { x: 0.5, y: 0.35 };
const RING = 0.03;
const MAX_RANGE = 1.25;

// Espace « logique » du canvas (portrait 1 × 1,5).
const CW = 460, CH = 690;
const lx = (x) => (x / FIELD.W) * CW;
const ly = (y) => (y / FIELD.H) * CH;
const lr = (r) => (r / FIELD.W) * CW;

// Couleur de flèche par siège (ordre d'arrivée dans la partie).
const SEAT_COLORS = ['#e0392e', '#2b5fd4', '#2e9c5c', '#f2c11f', '#7a3fbf', '#f28322'];

// Anneaux de la cible, de l'extérieur vers le centre (points 1 → 10).
const ringColor = (pts) => (pts >= 9 ? '#f2c11f' : pts >= 7 ? '#e0392e' : pts >= 5 ? '#3f74d6' : pts >= 3 ? '#2b2b31' : '#f4f1e8');

function drawScene(ctx, g, aim, colorBySeat, flying) {
  ctx.clearRect(0, 0, CW, CH);

  // pelouse avec bandes tondues
  const grass = ctx.createLinearGradient(0, 0, 0, CH);
  grass.addColorStop(0, '#5aa85f'); grass.addColorStop(1, '#3d8a4a');
  ctx.fillStyle = grass; ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < CH; y += 92) ctx.fillRect(0, y, CW, 46);

  // cible
  const TX = lx(TARGET.x), TY = ly(TARGET.y);
  ctx.beginPath(); ctx.ellipse(TX, TY + lr(RING) * 10.6, lr(RING) * 10.6, lr(RING) * 2.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
  for (let k = 10; k >= 1; k--) {
    ctx.beginPath(); ctx.arc(TX, TY, lr(RING) * k, 0, Math.PI * 2);
    ctx.fillStyle = ringColor(11 - k); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(TX, TY, 2.6, 0, Math.PI * 2); ctx.fillStyle = '#1c1c22'; ctx.fill();

  // flèches plantées (celle en plein vol est dessinée à part)
  const planted = flying ? g.arrows.slice(0, -1) : g.arrows;
  for (const a of planted) drawArrow(ctx, lx(a.x), ly(a.y), colorBySeat[a.by] || '#888');

  // visée « lance-pierre » : trajectoire en gros pointillés + arc bandé
  if (aim && aim.power > 0.02) {
    const len = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy) || 1;
    const ux = aim.dx / len, uy = aim.dy / len;
    const range = aim.power * MAX_RANGE;
    ctx.setLineDash([14, 11]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx(BOW.x), ly(BOW.y));
    ctx.lineTo(lx(BOW.x + ux * range), ly(BOW.y + uy * range));
    ctx.stroke();
    ctx.setLineDash([]);
    // point de chute visé (sans le vent : à toi de compenser !)
    ctx.beginPath(); ctx.arc(lx(BOW.x + ux * range), ly(BOW.y + uy * range), 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
  }

  // arc en bas (corde tendue selon la puissance)
  drawBow(ctx, aim);

  // flèche en plein vol
  if (flying) {
    const { x, y, ux, uy, s } = flying;
    ctx.save();
    ctx.translate(lx(x), ly(y));
    ctx.rotate(Math.atan2(uy, ux));
    ctx.scale(s, s);
    ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.fillStyle = '#c9cdd4';
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(9, -4); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = flying.color;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-11, -4.5); ctx.lineTo(-8, 0); ctx.lineTo(-11, 4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// Petite flèche plantée : point coloré + empennage.
function drawArrow(ctx, X, Y, color) {
  ctx.beginPath(); ctx.arc(X + 3, Y + 4, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + 9, Y - 13); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(X + 9, Y - 13); ctx.lineTo(X + 14, Y - 17); ctx.lineTo(X + 10, Y - 19); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(X, Y, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2b31'; ctx.fill();
}

function drawBow(ctx, aim) {
  const BX = lx(BOW.x), BY = ly(BOW.y);
  const pull = aim ? Math.min(1, aim.power) * 20 : 0;
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(BX, BY, 42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  const ax = BX + 42 * Math.cos(Math.PI * 1.15), ay = BY + 42 * Math.sin(Math.PI * 1.15);
  const bx = BX + 42 * Math.cos(Math.PI * 1.85), by = BY + 42 * Math.sin(Math.PI * 1.85);
  ctx.strokeStyle = '#e8e2d4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(BX, BY - 30 + pull); ctx.lineTo(bx, by); ctx.stroke();
}

export default function Archery({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const colorBySeat = Object.fromEntries(g.seats.map((id, i) => [id, SEAT_COLORS[i % SEAT_COLORS.length]]));

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dragRef = useRef(null);
  const [aim, setAim] = useState(null); // { dx, dy, power }
  const [animating, setAnimating] = useState(false);
  const lastShotSeq = useRef(g.lastShot?.seq || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase]);

  const render = (aimLine, flying) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawScene(ctx, g, aimLine, colorBySeat, flying);
  };

  // Nouveau tir : anime le vol de la flèche de l'arc au point d'impact.
  useEffect(() => {
    const shot = g.lastShot;
    if (!shot || shot.seq === lastShotSeq.current) { if (!animating) render(aim, null); return; }
    lastShotSeq.current = shot.seq;
    popSound();
    setAnimating(true);
    cancelAnimationFrame(animRef.current);
    const dx = shot.x - BOW.x, dy = shot.y - BOW.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dur = 320 + len * 320;
    const t0 = performance.now();
    const loop = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      render(null, {
        x: BOW.x + dx * t,
        y: BOW.y + dy * t,
        ux: dx / len, uy: dy / len,
        s: 1 + Math.sin(Math.PI * t) * 0.8, // la flèche « monte » puis retombe
        color: colorBySeat[shot.by] || '#888',
      });
      if (t < 1) { animRef.current = requestAnimationFrame(loop); }
      else {
        setAnimating(false);
        render(null, null);
        if (shot.pts > 0) boomSound(shot.pts >= 9);
      }
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [g.lastShot?.seq]);

  useEffect(() => { if (!animating) render(aim, null); }, [aim, g.isMyTurn, animating, g.phase, g.arrows.length]);

  // Écran (px canvas) -> coordonnées terrain.
  function fieldPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * FIELD.W,
      y: ((e.clientY - rect.top) / rect.height) * FIELD.H,
    };
  }

  // Tir « lance-pierre » : on pose le doigt, on tire EN ARRIÈRE pour doser,
  // on relâche pour décocher (comme au billard).
  function onDown(e) {
    if (!g.isMyTurn || animating || g.phase !== 'playing') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = fieldPoint(e);
    setAim({ dx: 0, dy: 0, power: 0 });
  }
  function onMove(e) {
    if (!dragRef.current) return;
    const p = fieldPoint(e);
    const dx = dragRef.current.x - p.x;   // direction opposée au glisser
    const dy = dragRef.current.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setAim({ dx, dy, power: Math.min(1, dist / 0.9) });
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
        <h3 className="section-title"><Target size={20} color="#e0392e" /> Tir à l'arc — salle d'attente</h3>
        <p className="cn-hint-text">Chacune tire 5 flèches, une par tour. Pose le doigt, tire vers l'arrière pour bander l'arc, relâche pour décocher. Attention au vent : il change à chaque flèche et dévie ton tir ! Centre = 10 points, bord = 1 point. Le plus grand total gagne. De 2 à 6 joueuses.</p>
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
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const windForce = Math.round(Math.abs(g.wind) * 200); // 0..10
  const windArrow = g.wind < 0 ? '←' : '→';
  const banner = g.phase === 'over'
    ? (g.winners?.length > 1
      ? (g.winners.includes(me) ? 'Égalité — tu partages la victoire !' : `Égalité entre ${g.winners.map((id) => nameById[id] || '?').join(' et ')} !`)
      : (g.winners?.[0] === me ? 'Tu gagnes la partie !' : `${nameById[g.winners?.[0]] || '?'} gagne la partie !`))
    : animating ? 'La flèche vole…'
      : g.isMyTurn
        ? (aim && aim.power > 0.02 ? `Puissance ${Math.round(aim.power * 100)} % — relâche pour décocher` : 'Pose le doigt et tire vers l\'arrière pour viser')
        : `Au tour de ${nameById[g.turn] || '?'}…`;

  return (
    <div className="archery fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="pool-players">
        {g.seats.map((id) => (
          <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}>
            <span className="archery-dot" style={{ background: colorBySeat[id] }} />
            <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
            <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            <b>{g.scores[id] || 0} pts</b>
          </div>
        ))}
      </div>

      {g.phase === 'playing' && (
        <div className="archery-wind">
          <Wind size={16} />
          <span>Vent : {windForce === 0 ? 'aucun' : `${windArrow.repeat(Math.max(1, Math.ceil(windForce / 4)))} ${windForce}`}</span>
          <span className="archery-round">Flèche {g.round}/{g.rounds}</span>
        </div>
      )}

      <div className="archery-wrap">
        <canvas ref={canvasRef} width={CW} height={CH}
          className={`archery-canvas ${g.isMyTurn && !animating ? 'aiming' : ''}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

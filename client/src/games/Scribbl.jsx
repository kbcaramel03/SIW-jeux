import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, TextField } from '@mui/material';
import { Play, Sparkles, Send, Eraser, Trash2, Pencil } from 'lucide-react';
import { getSocket } from '../socket.js';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti } from '../effects.js';

const W = 800;
const H = 600;
const COLORS = ['#2a2230', '#e4433a', '#ef8c2f', '#edb015', '#3aa856', '#2b7fd4', '#8d5bc6', '#cf7b97', '#7c5a32', '#ffffff'];

export default function Scribbl({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const nameById = Object.fromEntries(room.players.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(room.players.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(room.players.map((p) => [p.id, p.avatar]));

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const [color, setColor] = useState('#2a2230');
  const [size, setSize] = useState(5);
  const [eraser, setEraser] = useState(false);
  const [guess, setGuess] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) winConfetti();
  }, [g.phase]);

  // Contexte canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  }, [g.phase]);

  const clearCanvas = () => { const ctx = ctxRef.current; if (ctx) ctx.clearRect(0, 0, W, H); };
  function drawSeg(s) {
    const ctx = ctxRef.current; if (!ctx) return;
    ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
    ctx.beginPath(); ctx.moveTo(s.x0 * W, s.y0 * H); ctx.lineTo(s.x1 * W, s.y1 * H); ctx.stroke();
  }

  // Réception des traits + effacement (chez les non-dessinateurs)
  useEffect(() => {
    const s = getSocket();
    const onDraw = (d) => { if (d?.clear) clearCanvas(); else drawSeg(d); };
    s.on('scribbl:draw', onDraw);
    return () => s.off('scribbl:draw', onDraw);
  }, []);
  // Nouveau tour -> on efface le tableau
  useEffect(() => { clearCanvas(); }, [g.drawer, g.round]);

  // Minuterie
  useEffect(() => {
    if (g.phase !== 'draw' || !g.deadline) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [g.phase, g.deadline]);
  const left = g.phase === 'draw' && g.deadline ? Math.max(0, Math.round((g.deadline - now) / 1000)) : null;
  useEffect(() => { if (left === 0 && g.phase === 'draw') onAction({ kind: 'timeup' }); }, [left]);
  // L'hôte déclenche la révélation progressive des lettres (le serveur décide quand).
  useEffect(() => {
    if (g.phase !== 'draw' || !isHost) return undefined;
    const t = setInterval(() => onAction({ kind: 'reveal' }), 2500);
    return () => clearInterval(t);
  }, [g.phase, isHost]);

  // Dessin (dessinatrice uniquement)
  const canDraw = g.isDrawer && g.phase === 'draw';
  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function down(e) { if (!canDraw) return; drawingRef.current = true; lastRef.current = pos(e); }
  function move(e) {
    if (!canDraw || !drawingRef.current) return;
    const p = pos(e); const last = lastRef.current;
    const seg = { x0: last.x, y0: last.y, x1: p.x, y1: p.y, color: eraser ? '#ffffff' : color, size: eraser ? size * 3 : size };
    drawSeg(seg); getSocket().emit('scribbl:draw', seg);
    lastRef.current = p;
  }
  function up() { drawingRef.current = false; }
  function clearAll() { clearCanvas(); getSocket().emit('scribbl:draw', { clear: true }); }
  function sendGuess() { const t = guess.trim(); if (!t) return; onAction({ kind: 'guess', text: t }); setGuess(''); }

  // ----- Salle d'attente -----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Scribbl — salle d'attente</h3>
        <p className="cn-hint-text">À tour de rôle, une personne dessine un mot, les autres devinent au plus vite ! (2 à 10 joueurs)</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat"><Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} /><span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span></div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer</Button>}
        </div>
        {g.amSeated && g.seats.length < 2 && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 2 joueurs…</p>}
      </div>
    );
  }

  function topText() {
    if (g.phase === 'over') return g.winner === me ? '🎉 Tu gagnes !' : `🏆 ${nameById[g.winner] || '?'} gagne`;
    if (g.phase === 'turnend') return `Le mot était : ${g.reveal}`;
    if (g.phase === 'choose') return g.isDrawer ? 'Choisis un mot à dessiner' : `${nameById[g.drawer] || '?'} choisit un mot…`;
    // draw
    if (g.isDrawer) return `Dessine : ${g.word}`;
    return g.iGuessed ? '✅ Trouvé ! Attends les autres…' : `Devine : ${g.hint}`;
  }

  return (
    <div className="scr fade-up">
      <div className="scr-top">
        <span className="scr-round">Manche {g.round}/{g.totalRounds}</span>
        <span className="scr-word">{topText()}</span>
        {left != null && <span className="scr-timer">⏱ {left}s</span>}
      </div>

      <div className="scr-main">
        <div className="scr-canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H} className={`scr-canvas ${canDraw ? 'drawing' : ''}`}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
          {/* Choix du mot (dessinatrice) */}
          {g.phase === 'choose' && g.isDrawer && g.choices && (
            <div className="scr-choose">
              <p>Choisis ton mot :</p>
              <div className="scr-choices">{g.choices.map((w) => <Button key={w} variant="contained" onClick={() => onAction({ kind: 'choose', word: w })}>{w}</Button>)}</div>
            </div>
          )}
          {/* Outils (dessinatrice) */}
          {canDraw && (
            <div className="scr-tools">
              {COLORS.map((c) => <button key={c} className={`scr-color ${color === c && !eraser ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setEraser(false); }} />)}
              <IconButton size="small" className={eraser ? 'on' : ''} onClick={() => setEraser((e) => !e)} title="Gomme"><Eraser size={18} /></IconButton>
              <input type="range" min="2" max="24" value={size} onChange={(e) => setSize(Number(e.target.value))} className="scr-size" />
              <IconButton size="small" onClick={clearAll} title="Tout effacer"><Trash2 size={18} /></IconButton>
            </div>
          )}
          {/* Champ de réponse juste sous le tableau */}
          {g.canGuess && (
            <div className="scr-guess">
              <TextField size="small" fullWidth autoComplete="off" placeholder="Ta réponse…" value={guess}
                onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendGuess(); } }} />
              <IconButton color="primary" onClick={sendGuess}><Send size={20} /></IconButton>
            </div>
          )}
          {g.iGuessed && g.phase === 'draw' && <div className="scr-found">✅ Tu as trouvé ! Patiente…</div>}
        </div>

        <div className="scr-side">
          <div className="scr-scores">
            {g.players.slice().sort((a, b) => b.score - a.score).map((p) => (
              <div key={p.id} className={`scr-pl ${p.guessed ? 'guessed' : ''}`}>
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={26} />
                <span className="scr-pl-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
                {p.isDrawer && <Pencil size={13} />}
                {p.guessed && <span className="scr-check">✓</span>}
                <span className="scr-pl-score">{p.score}</span>
              </div>
            ))}
          </div>
          <div className="scr-log">
            {g.log.map((l, i) => (
              <div key={i} className={`scr-line ${l.kind}`}>
                {l.kind === 'system' ? l.text
                  : l.kind === 'correct' ? <><b>{nameById[l.id] || '?'}</b> {l.text}</>
                    : <><b>{nameById[l.id] || '?'}</b> : {l.text}</>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {g.phase === 'turnend' && isHost && <div className="cn-controls"><Button variant="contained" onClick={() => onAction({ kind: 'next' })}>Tour suivant</Button></div>}
      {g.phase === 'turnend' && !isHost && <p className="muted" style={{ textAlign: 'center' }}>En attente de l'hôte…</p>}
      {g.phase === 'over' && isHost && <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>}
    </div>
  );
}

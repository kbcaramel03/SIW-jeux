import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Star, ArrowRight } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, boomSound, diceSound, popSound, burstAtEl } from '../effects.js';

// ---- Géométrie du plateau classique (grille 15×15, coordonnées en cases) ----
const U = 100 / 15;

// Piste de 52 cases en croix, dans le sens de la marche (horaire).
const TRACK = [
  [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
  [7, 6], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1],
  [8, 1],
  [9, 1], [9, 2], [9, 3], [9, 4], [9, 5], [9, 6],
  [10, 7], [11, 7], [12, 7], [13, 7], [14, 7], [15, 7],
  [15, 8],
  [15, 9], [14, 9], [13, 9], [12, 9], [11, 9], [10, 9],
  [9, 10], [9, 11], [9, 12], [9, 13], [9, 14], [9, 15],
  [8, 15],
  [7, 15], [7, 14], [7, 13], [7, 12], [7, 11], [7, 10],
  [6, 9], [5, 9], [4, 9], [3, 9], [2, 9], [1, 9],
  [1, 8],
];
const START = { red: 1, green: 14, yellow: 27, blue: 40 };
const START_BY_CELL = { 1: 'red', 14: 'green', 27: 'yellow', 40: 'blue' };
const STARS = [9, 22, 35, 48]; // cases étoiles protégées pour tout le monde
// Flèches de sens de marche sur les cases départ (rotation en degrés depuis →).
const START_ARROW = { 1: 0, 14: 90, 27: 180, 40: 270 };

// Colonnes d'arrivée (5 cases) vers le centre.
const HOME = {
  red: [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8]],
  green: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6]],
  yellow: [[14, 8], [13, 8], [12, 8], [11, 8], [10, 8]],
  blue: [[8, 14], [8, 13], [8, 12], [8, 11], [8, 10]],
};
// Écuries : grands blocs colorés aux quatre coins.
const BASE_ORIGIN = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
const BASE_SLOTS = [[2, 2], [4, 2], [2, 4], [4, 4]]; // centres, relatifs au coin
const GOAL_SPOT = { red: [6.7, 7.5], green: [7.5, 6.7], yellow: [8.3, 7.5], blue: [7.5, 8.3] };

const HEX = { red: '#e4433a', green: '#3aa856', yellow: '#edb015', blue: '#2b7fd4' };
const HEX_DARK = { red: '#b32d26', green: '#27753c', yellow: '#bf8a0a', blue: '#1d5fa3' };
const TINT = { red: '#fbdedc', green: '#dcf2e3', yellow: '#fdf2d0', blue: '#dcebf9' };

// Centre (en unités de case) d'un pion selon sa position p et sa couleur.
function spotOf(color, p, pawnIdx) {
  if (p === -1) {
    const [ox, oy] = BASE_ORIGIN[color];
    const [sx, sy] = BASE_SLOTS[pawnIdx];
    return [ox + sx, oy + sy];
  }
  if (p <= 50) {
    const [c, r] = TRACK[(START[color] + p) % 52];
    return [c - 0.5, r - 0.5];
  }
  if (p <= 55) {
    const [c, r] = HOME[color][p - 51];
    return [c - 0.5, r - 0.5];
  }
  return GOAL_SPOT[color];
}

// ---- Pion SVG (dégradé, contour blanc, reflet) -------------------------------
function Pawn({ color }) {
  const gid = `lp-${color}`;
  return (
    <svg viewBox="0 0 40 48" className="ludo-pawn-svg">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="28%" stopColor={HEX[color]} />
          <stop offset="100%" stopColor={HEX_DARK[color]} />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="44.5" rx="13" ry="3.4" fill="rgba(40,20,50,0.25)" />
      <path
        d="M20 3.5a9.2 9.2 0 0 1 9.2 9.2c0 3.6-2.1 6.3-4.2 8.2 3.9 3.4 8.2 9.6 8.2 17.6 0 3.1-5.9 5-13.2 5s-13.2-1.9-13.2-5c0-8 4.3-14.2 8.2-17.6-2.1-1.9-4.2-4.6-4.2-8.2A9.2 9.2 0 0 1 20 3.5Z"
        fill={`url(#${gid})`} stroke="#fff" strokeWidth="2.4" strokeLinejoin="round"
      />
      <ellipse cx="16.4" cy="10.5" rx="3.1" ry="4.2" fill="#fff" opacity="0.5" transform="rotate(-18 16.4 10.5)" />
    </svg>
  );
}

// ---- Dé 3D 100 % CSS, animé à chaque lancer ----------------------------------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, 90], 4: [0, -90], 5: [90, 0], 6: [0, 180] };
const FACE_PLACE = {
  1: 'translateZ(27px)',
  2: 'rotateX(90deg) translateZ(27px)',
  3: 'rotateY(-90deg) translateZ(27px)',
  4: 'rotateY(90deg) translateZ(27px)',
  5: 'rotateX(-90deg) translateZ(27px)',
  6: 'rotateY(180deg) translateZ(27px)',
};

function Dice({ value, lastValue, seq, canRoll, onRoll, color }) {
  const v = value || lastValue || 6;
  const [rx, ry] = FACE_ROT[v];
  return (
    <button
      className={`ludo-dice ${canRoll ? 'can-roll' : ''}`}
      onClick={() => canRoll && onRoll()}
      disabled={!canRoll}
      aria-label={canRoll ? 'Lancer le dé' : `Dé : ${value ?? '—'}`}
      style={{ '--dice-accent': HEX[color] || '#9a83b4' }}
    >
      <motion.div
        className="ludo-dice-cube"
        animate={{ rotateX: rx + seq * 360, rotateY: ry + seq * 360 }}
        transition={{ duration: 0.85, ease: [0.2, 0.8, 0.3, 1] }}
      >
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <div key={f} className="ludo-dice-face" style={{ transform: FACE_PLACE[f] }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f].includes(i) ? 'pip' : 'pip off'} />
            ))}
          </div>
        ))}
      </motion.div>
    </button>
  );
}

// ---- Composant principal ------------------------------------------------------
export default function Ludo({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = '🤖 IA';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const boardRef = useRef(null);
  const lastDie = useRef(g.dieSeq);
  const lastEvent = useRef(g.lastEvent?.seq || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);

  // Sons & effets sur les événements de jeu.
  useEffect(() => {
    if (g.dieSeq !== lastDie.current) { lastDie.current = g.dieSeq; diceSound(); }
  }, [g.dieSeq]);
  useEffect(() => {
    const ev = g.lastEvent;
    if (!ev || ev.seq === lastEvent.current) return;
    lastEvent.current = ev.seq;
    if (ev.kind === 'capture') { boomSound(); burstAtEl(boardRef.current); }
    else if (ev.kind === 'goal') { popSound(); burstAtEl(boardRef.current, true); }
    else popSound();
  }, [g.lastEvent?.seq]);
  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) { winConfetti(); boomSound(true); }
  }, [g.phase]);

  const myColor = g.players.find((p) => p.id === me)?.color || null;

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card ludo-wait">
        <h3 className="section-title">🎲 Ludo</h3>
        <p className="muted">2 à 4 joueuses. Sors tes pions avec un <b>1 ou un 6</b>, fais le tour du plateau
          et rentre tes 4 pions ! Les cases ⭐ sont protégées, et on ne peut pas s'empiler : une pièce par case.</p>
        <div className="uno-seats">
          {g.seats.map((id, i) => (
            <div key={id} className="uno-seat">
              <span className="ludo-dot" style={{ background: HEX[['red', 'green', 'yellow', 'blue'][i]] }} />
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            </div>
          ))}
        </div>
        {g.canStart
          ? <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Lancer la partie ({g.seats.length} joueuses)</Button>
          : <p className="muted">En attente d'au moins 2 joueuses…</p>}
        {g.amSeated && g.seats.length < 4 && !g.seats.includes('bot') && <Button variant="outlined" color="secondary" onClick={() => onAction({ kind: 'bot' })}>🤖 Inviter l'IA</Button>}
      </div>
    );
  }

  // ---- Bannière de statut ----
  const turnName = g.turn === me ? null : (nameById[g.turn] || '?');
  const banner = g.phase === 'over'
    ? (g.winner === me ? '🏆 Tu as gagné !' : `🏆 ${nameById[g.winner] || '?'} gagne la partie !`)
    : !g.amSeated ? 'Partie en cours — tu regardes'
      : g.canRoll ? '🎲 À toi : lance le dé !'
        : g.isMyTurn ? `Tu as fait ${g.die} — choisis un pion`
          : `Au tour de ${turnName}…`;

  // ---- Pions (léger décalage si plusieurs pions rentrés au même endroit) ----
  const tokens = [];
  for (const pl of g.players) {
    pl.pawns.forEach((p, i) => tokens.push({ id: `${pl.id}-${i}`, owner: pl.id, color: pl.color, p, idx: i }));
  }
  const bySpot = {};
  for (const t of tokens) {
    const [x, y] = spotOf(t.color, t.p, t.idx);
    t.x = x; t.y = y;
    const k = `${Math.round(x * 10)}-${Math.round(y * 10)}`;
    (bySpot[k] ||= []).push(t);
  }
  for (const group of Object.values(bySpot)) {
    group.forEach((t, i) => { if (group.length > 1) t.x += (i - (group.length - 1) / 2) * 0.34; });
  }

  return (
    <div className="ludo">
      <div className={`uno-turn-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      {/* Joueuses : couleur, avatar, pions rentrés, tour actif */}
      <div className="ludo-players">
        {g.players.map((pl) => (
          <div key={pl.id} className={`ludo-chip ${g.turn === pl.id && g.phase === 'playing' ? 'active' : ''}`}
            style={{ '--pc': HEX[pl.color] }}>
            <Avatar name={nameById[pl.id]} gender={genderById[pl.id]} avatar={avatarById[pl.id]} size={26} />
            <span className="ludo-chip-name">{nameById[pl.id] || '?'}{pl.id === me ? ' (toi)' : ''}</span>
            <span className="ludo-chip-home">{pl.rank ? `${['🥇', '🥈', '🥉', '4ᵉ'][pl.rank - 1]}` : `${pl.home}/4 🏠`}</span>
          </div>
        ))}
      </div>

      {/* Plateau + dé côte à côte (le dé passe dessous sur mobile) */}
      <div className="ludo-main">
      <div className="ludo-board" ref={boardRef}>
        {/* Écuries (coins) */}
        {Object.entries(BASE_ORIGIN).map(([color, [ox, oy]]) => (
          <div key={color} className="ludo-base"
            style={{ left: `${ox * U}%`, top: `${oy * U}%`, width: `${6 * U}%`, height: `${6 * U}%`, background: HEX[color] }}>
            <div className="ludo-base-panel" />
            {BASE_SLOTS.map(([sx, sy], i) => (
              <span key={i} className="ludo-base-slot" style={{ left: `${(sx / 6) * 100}%`, top: `${(sy / 6) * 100}%` }} />
            ))}
          </div>
        ))}

        {/* Piste */}
        {TRACK.map(([c, r], i) => {
          const startColor = START_BY_CELL[i];
          const star = STARS.includes(i);
          return (
            <div key={i}
              className={`ludo-cell ${star ? 'star-cell' : ''}`}
              style={{
                left: `${(c - 1) * U}%`, top: `${(r - 1) * U}%`, width: `${U}%`, height: `${U}%`,
                background: startColor ? HEX[startColor] : undefined,
                borderColor: startColor ? HEX_DARK[startColor] : undefined,
              }}>
              {star && <Star className="ludo-star gold" size={15} fill="#f5c022" stroke="#c79204" strokeWidth={1.4} />}
              {startColor && <ArrowRight className="ludo-arrow" size={14} color="#ffffff" strokeWidth={3.2}
                style={{ transform: `rotate(${START_ARROW[i]}deg)` }} />}
            </div>
          );
        })}

        {/* Colonnes d'arrivée */}
        {Object.entries(HOME).map(([color, cells]) => cells.map(([c, r], i) => (
          <div key={`${color}-${i}`} className="ludo-cell lane"
            style={{ left: `${(c - 1) * U}%`, top: `${(r - 1) * U}%`, width: `${U}%`, height: `${U}%`, background: TINT[color], borderColor: HEX[color] }} />
        )))}

        {/* Centre : 4 triangles vers les arrivées */}
        <svg className="ludo-center" viewBox="0 0 90 90" style={{ left: `${6 * U}%`, top: `${6 * U}%`, width: `${3 * U}%`, height: `${3 * U}%` }}>
          <polygon points="0,0 45,45 0,90" fill={HEX.red} />
          <polygon points="0,0 90,0 45,45" fill={HEX.green} />
          <polygon points="90,0 90,90 45,45" fill={HEX.yellow} />
          <polygon points="0,90 45,45 90,90" fill={HEX.blue} />
          <circle cx="45" cy="45" r="11" fill="#fff" />
          <text x="45" y="49.5" textAnchor="middle" fontSize="13">🏆</text>
        </svg>

        {/* Pions */}
        {tokens.map((t) => {
          const movable = g.isMyTurn && t.owner === me && g.movable.includes(t.idx);
          return (
            <motion.div
              key={t.id}
              className={`ludo-token ${movable ? 'movable' : ''} ${t.p === 56 ? 'done' : ''}`}
              animate={{ left: `${t.x * U}%`, top: `${t.y * U}%` }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              style={{ zIndex: movable ? 30 : 20 }}
              onClick={() => movable && onAction({ kind: 'move', pawn: t.idx })}
            >
              <Pawn color={t.color} />
            </motion.div>
          );
        })}
      </div>

      {/* Dé + infos */}
      <div className="ludo-controls">
        <Dice value={g.die} lastValue={g.lastDie} seq={g.dieSeq} canRoll={g.canRoll} color={myColor}
          onRoll={() => onAction({ kind: 'roll' })} />
        {g.canRoll && <span className="ludo-roll-hint">Tape le dé !</span>}
        {g.sixes === 2 && g.phase === 'playing' && <span className="ludo-sixes">⚠️ Encore un 6 et le tour est perdu !</span>}
      </div>
      </div>

      {g.phase === 'over' && (
        <div className="ludo-podium">
          {g.ranks.map((id, i) => (
            <div key={id} className="ludo-podium-row">
              <span>{['🥇', '🥈', '🥉', '🎖️'][i]}</span>
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={24} />
              <b>{nameById[id] || '?'}</b>
            </div>
          ))}
          {isHost && <Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button>}
        </div>
      )}

      {!g.amSeated && g.phase === 'playing' && <p className="muted" style={{ textAlign: 'center' }}>Partie en cours — tu pourras rejoindre à la prochaine.</p>}
    </div>
  );
}

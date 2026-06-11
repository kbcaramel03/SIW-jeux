import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Flag, Handshake } from 'lucide-react';
import { FaChessKing, FaChessQueen, FaChessRook, FaChessBishop, FaChessKnight, FaChessPawn } from 'react-icons/fa';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, boomSound, popSound } from '../effects.js';

const ICONS = { k: FaChessKing, q: FaChessQueen, r: FaChessRook, b: FaChessBishop, n: FaChessKnight, p: FaChessPawn };
const FILES = 'abcdefgh';
const sqName = (r, c) => FILES[c] + (8 - r);

function Piece({ type, color, small }) {
  const Icon = ICONS[type];
  return <Icon className={`ch-piece ${color === 'w' ? 'white' : 'black'} ${small ? 'small' : ''}`} />;
}

export default function Echecs({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [selected, setSelected] = useState(null);   // case sélectionnée ('e2')
  const [promo, setPromo] = useState(null);         // { from, to } en attente du choix
  const lastSeq = useRef(g.moveSeq);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setSelected(null); setPromo(null); }, [g.moveCount, g.phase]);

  // Sons : coup / capture, victoire.
  useEffect(() => {
    if (g.moveSeq === lastSeq.current) return;
    lastSeq.current = g.moveSeq;
    if (g.lastFlags?.includes('c') || g.lastFlags?.includes('e')) boomSound(); else popSound();
  }, [g.moveSeq]);
  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) { winConfetti(); boomSound(true); }
  }, [g.phase]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card ludo-wait">
        <h3 className="section-title">♟️ Échecs</h3>
        <p className="muted">Le grand classique, règles officielles complètes : roque, prise en passant,
          promotion, pat… Les couleurs sont tirées au sort.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            </div>
          ))}
        </div>
        {g.canStart
          ? <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Lancer la partie</Button>
          : <p className="muted">En attente d'une adversaire…</p>}
      </div>
    );
  }

  const flip = g.myColor === 'b';
  const legalFrom = new Set(g.legal.map((m) => m.from));
  const targets = selected ? g.legal.filter((m) => m.from === selected) : [];
  const targetSquares = new Map(targets.map((m) => [m.to, m]));

  // Roi en échec : pour le halo rouge.
  let checkSquare = null;
  if (g.inCheck && g.board) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = g.board[r][c];
      if (sq && sq.type === 'k' && sq.color === g.turnColor) checkSquare = sqName(r, c);
    }
  }

  function clickSquare(r, c) {
    if (!g.isMyTurn || g.phase !== 'playing') return;
    const name = sqName(r, c);
    const piece = g.board[r][c];
    const target = targetSquares.get(name);
    if (target) {
      if (target.promotion) { setPromo({ from: target.from, to: target.to }); return; }
      onAction({ kind: 'move', from: target.from, to: target.to });
      setSelected(null);
      return;
    }
    if (piece && piece.color === g.myColor && legalFrom.has(name)) {
      setSelected(name === selected ? null : name);
    } else {
      setSelected(null);
    }
  }

  const banner = g.phase === 'over'
    ? `${g.resultText} ${g.winner ? (g.winner === me ? 'Tu gagnes ! 🏆' : `${nameById[g.winner] || '?'} gagne 🏆`) : ''}`
    : !g.amSeated ? 'Partie en cours — tu regardes'
      : g.isMyTurn ? (g.inCheck ? '⚠️ Tu es en échec — défends-toi !' : '♟️ À toi de jouer')
        : `Au tour de ${nameById[g.turnColor === 'w' ? g.white : g.black] || '?'}…`;

  const rows = [...Array(8).keys()];
  const cols = [...Array(8).keys()];

  const playerBar = (id, color) => (
    <div className={`ch-player ${g.phase === 'playing' && g.turnColor === color ? 'active' : ''}`}>
      <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
      <span className="ch-player-name">{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
      <span className={`ch-color-dot ${color === 'w' ? 'white' : 'black'}`} />
      <span className="ch-captured">
        {g.captured[color].map((t, i) => <Piece key={i} type={t} color={color === 'w' ? 'b' : 'w'} small />)}
      </span>
    </div>
  );

  return (
    <div className="ludo">
      <div className={`uno-turn-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="ludo-main">
        <div className="ch-wrap">
          {playerBar(flip ? g.white : g.black, flip ? 'w' : 'b')}
          <div className="ch-board">
            {rows.map((r0) => cols.map((c0) => {
              const r = flip ? 7 - r0 : r0;
              const c = flip ? 7 - c0 : c0;
              const name = sqName(r, c);
              const piece = g.board[r][c];
              const dark = (r + c) % 2 === 1;
              const isTarget = targetSquares.has(name);
              const isLast = g.lastMove && (g.lastMove.from === name || g.lastMove.to === name);
              return (
                <div key={name}
                  className={`ch-sq ${dark ? 'dark' : 'light'} ${selected === name ? 'selected' : ''} ${isLast ? 'last' : ''} ${checkSquare === name ? 'check' : ''} ${g.isMyTurn && piece && piece.color === g.myColor && legalFrom.has(name) ? 'mine' : ''}`}
                  onClick={() => clickSquare(r, c)}>
                  {c0 === 0 && <span className="ch-coord rank">{8 - r}</span>}
                  {r0 === 7 && <span className="ch-coord file">{FILES[c]}</span>}
                  {piece && <Piece type={piece.type} color={piece.color} />}
                  {isTarget && <span className={`ch-dot ${piece ? 'capture' : ''}`} />}
                </div>
              );
            }))}

            {/* Choix de promotion */}
            {promo && (
              <div className="ch-promo">
                <p>Promotion !</p>
                <div className="ch-promo-row">
                  {['q', 'r', 'b', 'n'].map((t) => (
                    <button key={t} onClick={() => { onAction({ kind: 'move', from: promo.from, to: promo.to, promotion: t }); setPromo(null); setSelected(null); }}>
                      <Piece type={t} color={g.myColor} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {playerBar(flip ? g.black : g.white, flip ? 'b' : 'w')}
        </div>

        <div className="ludo-controls">
          {g.history.length > 0 && (
            <div className="ch-history">{g.history.join('  ')}</div>
          )}
          {g.phase === 'playing' && g.amSeated && (
            <>
              {g.drawOffer && g.drawOffer !== me
                ? <Button size="small" variant="contained" color="secondary" startIcon={<Handshake size={16} />}
                    onClick={() => onAction({ kind: 'draw' })}>Accepter la nulle</Button>
                : <Button size="small" variant="outlined" startIcon={<Handshake size={16} />} disabled={g.drawOffer === me}
                    onClick={() => onAction({ kind: 'draw' })}>{g.drawOffer === me ? 'Nulle proposée…' : 'Proposer nulle'}</Button>}
              <Button size="small" variant="outlined" color="error" startIcon={<Flag size={16} />}
                onClick={() => window.confirm('Abandonner la partie ?') && onAction({ kind: 'resign' })}>Abandonner</Button>
            </>
          )}
          {g.drawOffer && g.drawOffer !== me && <span className="ludo-sixes">🤝 {nameById[g.drawOffer] || '?'} propose la nulle</span>}
        </div>
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

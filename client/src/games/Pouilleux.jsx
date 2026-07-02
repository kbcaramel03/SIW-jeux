import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Skull, ShieldCheck } from 'lucide-react';
import MonsterCard, { MONSTERS } from './MonsterCard.jsx';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

export default function Pouilleux({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const lastSeq = useRef(g.lastAction?.seq || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    const a = g.lastAction;
    if (!a || a.seq === lastSeq.current) return;
    lastSeq.current = a.seq;
    if (a.kind === 'pair') boomSound(); else popSound();
  }, [g.lastAction?.seq]);
  useEffect(() => {
    if (g.phase === 'over' && !g.iLost) winConfetti();
  }, [g.phase]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Skull size={20} color="#5a8c3a" /> Zombie - salle d'attente</h3>
        <p className="cn-hint-text">Un jeu de hasard et de bluff. Le paquet contient des paires de créatures et une seule carte Zombie. Débarrassez-vous de vos paires, puis, à votre tour, piochez une carte au hasard chez votre voisine ; chaque paire formée est écartée. La joueuse qui se retrouve seule avec le Zombie a perdu. De 2 à 6 joueuses.</p>
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
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 2 joueuses…</p>}
      </div>
    );
  }

  function banner() {
    if (g.phase === 'over') return g.iLost ? 'Tu restes avec le Zombie… perdu !' : `${nameById[g.loser] || '?'} reste avec le Zombie !`;
    const a = g.lastAction;
    if (a && a.kind === 'pair') return `${a.by === me ? 'Tu jettes' : `${nameById[a.by]} jette`} une paire de ${MONSTERS[a.monster]?.name || a.monster}`;
    if (a && a.kind === 'draw') return `${a.by === me ? 'Tu pioches' : `${nameById[a.by]} pioche`} chez ${a.from === me ? 'toi' : nameById[a.from]}`;
    if (a && a.kind === 'safe') return `${a.by === me ? 'Tu es' : `${nameById[a.by]} est`} sauvée !`;
    return g.isMyTurn ? 'À toi : pioche chez ta voisine' : `Au tour de ${nameById[g.turn] || '?'}`;
  }

  const n = g.players.length;

  return (
    <div className="gf fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner()}</div>

      {/* Table ronde : toutes les joueuses en cercle */}
      <div className="gf-table pou-table">
        {g.players.map((p, i) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 41;
          const y = 50 + Math.sin(ang) * 43;
          const isMe = p.id === me;
          const isTarget = g.target === p.id;
          return (
            <div key={p.id} className={`gf-seat ${g.turn === p.id ? 'active' : ''} ${isTarget ? 'target' : ''} ${p.safe ? 'safe' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}>
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={42} />
              <span className="gf-seat-name">{nameById[p.id] || '?'}{isMe ? ' (toi)' : ''}</span>
              <span className="gf-seat-meta">{p.safe ? <b style={{ color: '#2e8c47' }}>sauvée ✓</b> : `${p.count} 🃏`}</span>
            </div>
          );
        })}
        <div className="pou-center"><Skull size={22} /></div>
      </div>

      {/* Mon tour : piocher une carte (face cachée) chez la voisine */}
      {g.isMyTurn && g.target && (
        <div className="pou-draw">
          <p className="gf-hint">Pioche une carte chez <b>{nameById[g.target]}</b> :</p>
          <div className="pou-target-hand">
            {Array.from({ length: g.targetCount }).map((_, i) => (
              <motion.div key={i} whileHover={{ y: -8 }} whileTap={{ scale: 0.94 }} className="pou-pick">
                <MonsterCard faceDown size="md" onClick={() => onAction({ kind: 'draw', index: i })} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
      {!g.isMyTurn && g.phase === 'playing' && <p className="muted" style={{ textAlign: 'center' }}>En attente de {nameById[g.turn] || '?'}…</p>}

      {/* Ma main (face visible, paires déjà écartées) */}
      <div className="gf-hand">
        <AnimatePresence mode="popLayout">
          {g.myHand.map((card) => (
            <motion.div key={card.id} layout
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="gf-hand-card">
              <MonsterCard kind={card.kind} size="md" />
            </motion.div>
          ))}
        </AnimatePresence>
        {g.myHand.length === 0 && g.phase === 'playing' && <p className="muted"><ShieldCheck size={16} style={{ verticalAlign: '-3px' }} /> Tu n'as plus de cartes — sauvée !</p>}
      </div>

      {/* Fin */}
      {g.phase === 'over' && (
        <div className="gf-over">
          <div className={`pou-result ${g.iLost ? 'lose' : 'win'}`}>
            <MonsterCard kind="zombie" size="md" />
            <b>{g.iLost ? 'Tu gardes le Zombie… tu as perdu !' : `${nameById[g.loser] || '?'} garde le Zombie !`}</b>
          </div>
          {isHost && <Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button>}
        </div>
      )}
    </div>
  );
}

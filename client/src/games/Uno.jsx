import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Hand, SkipForward, Sparkles, RotateCw } from 'lucide-react';
import UnoCard from './UnoCard.jsx';
import { Avatar } from '../components/OnlineRail.jsx';
import botAvatar from '../assets/chatgpt.svg';
import { winConfetti } from '../effects.js';

const COLORS = ['red', 'yellow', 'green', 'blue'];

function isPlayable(card, currentColor, topType) {
  return card.color === 'wild' || card.color === currentColor || card.type === topType;
}

export default function Uno({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;
  const [pendingWild, setPendingWild] = useState(null);

  useEffect(() => {
    if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' });
  }, [g.phase, g.amSeated]);

  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) winConfetti();
  }, [g.phase]);

  if (g.phase === 'waiting') {
    return (
      <div className="card uno-waiting" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Uno — salle d'attente</h3>
        <p className="cn-hint-text">Le grand classique des jeux de cartes. Défaussez-vous en posant une carte de même couleur ou de même valeur que celle du dessus. Les cartes spéciales (Plus 2, Plus 4, Joker, Passe et Inversion) renversent le cours de la partie. La première personne à vider sa main remporte la manche. De 2 à 8 joueuses.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            </div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && (
            <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre la partie</Button>
          )}
          {g.canStart && (
            <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>
          )}
          {g.amSeated && g.seats.length < 8 && !g.seats.includes('bot') && <Button variant="outlined" color="secondary" onClick={() => onAction({ kind: 'bot' })}>Inviter ChatGPT</Button>}
        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 2 joueurs…</p>}
      </div>
    );
  }

  const playableNow = (card) => {
    if (!g.isMyTurn) return false;
    if (g.myDrawnCardId != null) return card.id === g.myDrawnCardId;
    return isPlayable(card, g.currentColor, g.topType);
  };

  function playCard(card) {
    if (!playableNow(card)) return;
    if (card.color === 'wild') { setPendingWild(card.id); return; }
    onAction({ kind: 'play', cardId: card.id });
  }
  function chooseColor(color) {
    onAction({ kind: 'play', cardId: pendingWild, color });
    setPendingWild(null);
  }

  return (
    <div className="uno fade-up">
      {/* Table ronde : tous les joueurs dans l'ordre réel de la partie */}
      <div className="uno-table">
        {g.players.map((p, i) => {
          const n = g.players.length;
          const meIdx = Math.max(0, g.players.findIndex((pl) => pl.id === me));
          const rel = (i - meIdx + n) % n;
          const ang = ((90 + (rel / n) * 360) * Math.PI) / 180;
          const x = 50 + Math.cos(ang) * 42;
          const y = 50 + Math.sin(ang) * 39;
          const fanRot = (ang * 180) / Math.PI + 90;
          const fan = Math.min(p.count, 7);
          const penalty = g.lastPenalty?.targetId === p.id ? g.lastPenalty : null;
          return (
            <div key={p.id} className={`uno-opp ${p.id === me ? 'me' : ''} ${g.turn === p.id ? 'active' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="uno-opp-info">
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={26} />
                <span className="uno-opp-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
                <span className="uno-count">{p.count}</span>
              </div>
              <AnimatePresence>
                {penalty && (
                  <motion.div key={penalty.nonce} className="uno-penalty"
                    initial={{ scale: 0.35, y: -16, opacity: 0 }}
                    animate={{ scale: [0.35, 1.25, 1], y: [-16, -36, -30], opacity: [0, 1, 1] }}
                    exit={{ opacity: 0, y: -46 }}
                    transition={{ duration: 1.2 }}>
                    +{penalty.count}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="uno-opp-fan" style={{ transform: `rotate(${fanRot}deg)` }}>
                {Array.from({ length: fan }).map((_, j) => {
                  const rot = fan === 1 ? 0 : -22 + (44 / (fan - 1)) * j;
                  return (
                    <div key={j} className="uno-fan-card" style={{ transform: `rotate(${rot}deg)` }}>
                      <UnoCard faceDown size="mini" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Centre : pioche + défausse + sens + couleur courante */}
        <div className="uno-center">
          <div className="uno-pile">
            <UnoCard faceDown size="md" />
            <span className="uno-deck-count">{g.deckCount}</span>
          </div>
          <div className={`uno-discard color-${g.currentColor}`}>
            <AnimatePresence mode="popLayout">
              <motion.div key={g.topCard?.id}
                initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
                <UnoCard card={g.topCard} size="lg" />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="uno-meta">
            <span className={`uno-color-dot c-${g.currentColor}`} title="Couleur en cours" />
            <RotateCw size={18} style={{ transform: g.direction === -1 ? 'scaleX(-1)' : 'none' }} />
          </div>
        </div>
      </div>

      {/* Bannière de tour */}
      <div className={`uno-turn-banner ${g.isMyTurn ? 'mine' : ''}`}>
        {g.phase === 'over'
          ? (g.winner === me ? 'Tu as gagné !' : `${nameById[g.winner] || 'Quelqu\'un'} a gagné`)
          : !g.amSeated ? 'Manche en cours — tu regardes (rejoins à la prochaine)'
            : g.isMyTurn ? 'À toi de jouer !' : `Au tour de ${nameById[g.turn] || '?'}`}
      </div>

      {/* Ma main */}
      <div className="uno-hand">
        <AnimatePresence mode="popLayout">
          {g.myHand.map((card) => (
            <motion.div key={card.id} layout
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="uno-hand-card">
              <UnoCard card={card} size="md" playable={playableNow(card)} dim={g.isMyTurn && !playableNow(card)} onClick={() => playCard(card)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Contrôles */}
      {g.phase === 'playing' && g.isMyTurn && (
        <div className="cn-controls">
          {g.myDrawnCardId == null
            ? <Button variant="outlined" startIcon={<Hand size={16} />} onClick={() => onAction({ kind: 'draw' })}>Piocher</Button>
            : <Button variant="outlined" startIcon={<SkipForward size={16} />} onClick={() => onAction({ kind: 'pass' })}>Passer</Button>}
        </div>
      )}

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}

      {/* Choix de couleur (joker) */}
      {pendingWild != null && (
        <div className="uno-color-picker">
          <div className="uno-color-picker-box">
            <p>Choisis une couleur :</p>
            <div className="uno-color-choices">
              {COLORS.map((c) => <button key={c} className={`uno-color-choice c-${c}`} onClick={() => chooseColor(c)} />)}
            </div>
            <Button size="small" onClick={() => setPendingWild(null)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Hand, PauseCircle, Sparkles, Layers } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import botAvatar from '../assets/chatgpt.svg';
import Flip7Card, { Flip7Back } from './Flip7Card.jsx';
import { winConfetti } from '../effects.js';

const ACTION_INFO = {
  freeze: { label: 'Stop', icon: Hand, hint: 'Choisis qui est stoppé (toi ou un autre joueur encore en jeu) : il sort de la manche mais garde ses points.' },
  flip3: { label: 'Pioche 3', icon: Layers, hint: 'Choisis qui pioche 3 cartes d\'affilée (toi ou un autre joueur encore en jeu).' },
};

export default function Flip7({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' });
  }, [g.phase, g.amSeated]);

  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) winConfetti();
  }, [g.phase]);
  useEffect(() => {
    if (g.phase !== 'roundover' || !g.nextRoundAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, [g.phase, g.nextRoundAt]);

  // ----- Salle d'attente -----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Flip 7 — salle d'attente</h3>
        <p className="cn-hint-text">Un jeu de stop ou encore. À votre tour, vous piochez une carte chiffre : continuez pour accumuler des points, mais un doublon vous fait tout perdre pour la manche. Réunissez sept chiffres différents pour réaliser un Flip 7 et empocher un bonus. La première joueuse à 200 points l'emporte. De 2 à 8 joueuses.</p>
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

  const pa = g.pendingAction;
  const paInfo = pa ? ACTION_INFO[pa.type] : null;
  const nextRoundLeft = g.phase === 'roundover' && g.nextRoundAt
    ? Math.max(0, Math.ceil((g.nextRoundAt - now) / 1000))
    : null;

  function bannerText() {
    if (g.phase === 'over') return g.winner === me ? '🎉 Tu as gagné !' : `${nameById[g.winner] || 'Quelqu\'un'} remporte la partie`;
    if (g.phase === 'roundover') return `Fin de manche — suivante dans ${nextRoundLeft ?? 5}s`;
    if (pa) {
      if (g.iResolve) return `${paInfo.label} : à toi de choisir une cible`;
      return `${nameById[pa.by] || '?'} doit résoudre « ${paInfo.label} »`;
    }
    if (!g.amSeated) return 'Manche en cours — tu regardes';
    return g.isMyTurn ? 'À toi de jouer : tu tires ou tu restes ?' : `Au tour de ${nameById[g.turn] || '?'}`;
  }

  // Classement de la partie (score cumulé), trié en direct ; rang partagé en cas d'égalité.
  const standings = [...g.players].sort((a, b) => b.score - a.score);
  const rankOf = (p) => 1 + g.players.filter((q) => q.score > p.score).length;
  const rankMark = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}e`);

  return (
    <div className="f7 fade-up">
      {/* Classement temps réel (score cumulé) */}
      <div className="f7-standings">
        <span className="f7-standings-title">Classement</span>
        {standings.map((p) => {
          const r = rankOf(p);
          return (
            <div key={p.id} className={`f7-rank rank-${r <= 3 ? r : 'n'} ${p.id === me ? 'me' : ''}`}>
              <span className="f7-rank-pos">{rankMark(r)}</span>
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={22} />
              <span className="f7-rank-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              <span className="f7-rank-score">{p.score}</span>
            </div>
          );
        })}
      </div>

      <div className={`f7-banner ${g.isMyTurn && !pa ? 'mine' : ''}`}>
        <span>{bannerText()}</span>
        <span className="f7-meta">🎯 {g.target} pts</span>
      </div>

      {/* Pioche centrale */}
      {g.phase !== 'over' && (
        <div className="f7-table">
          <Flip7Back size="md" count={g.deckCount} />
          <span className="f7-table-label">Pioche</span>
        </div>
      )}

      {/* Choix de cible pour une action */}
      {pa && g.iResolve && (
        <div className="f7-resolve">
          <p className="f7-resolve-hint">
            {paInfo.icon && <paInfo.icon size={16} style={{ verticalAlign: -3 }} />} {paInfo.hint}
          </p>
          <div className="f7-targets">
            {g.targets.length === 0
              ? <span className="muted">Aucune cible possible…</span>
              : g.targets.map((id) => (
                <Button key={id} variant="outlined" size="small"
                  onClick={() => onAction({ kind: 'resolve', targetId: id })}>
                  {nameById[id] || '?'}{id === me ? ' (toi)' : ''}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Tableau des joueurs */}
      <div className="f7-players">
        {g.players.map((p) => {
          const l = p.line;
          const isTurn = g.turn === p.id && g.phase === 'playing' && !pa;
          const status = l?.busted ? 'busted' : l?.frozen ? 'frozen' : l?.flip7 ? 'flip7' : l?.stayed ? 'stayed' : '';
          return (
            <div key={p.id} className={`f7-player ${isTurn ? 'turn' : ''} ${status}`}>
              {/* Effet Flip 7 : éclat doré sur la section de la joueur */}
              {status === 'flip7' && (
                <motion.div className="f7-flip7-burst"
                  initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 13 }}>
                  <span className="f7-flip7-spark s1">✨</span>
                  <span className="f7-flip7-text">FLIP 7 !</span>
                  <span className="f7-flip7-spark s2">✨</span>
                </motion.div>
              )}

              {/* Cartes action posées sur cette joueur (en haut à droite).
                  Elles arrivent en grand (taille main) puis rapetissent en glissant vers le coin. */}
              {(l?.second || l?.actions?.length > 0) && (
                <div className="f7-player-actions">
                  {l?.actions?.map((a, i) => (
                    <motion.div key={`a${i}`} className="f7-action-fly"
                      initial={{ scale: 1.5, x: -66, y: 94, opacity: 0 }}
                      animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
                      <Flip7Card card={a} size="xs" flip={false} />
                    </motion.div>
                  ))}
                  {l?.second && (
                    <motion.div className="f7-action-fly"
                      initial={{ scale: 1.5, x: -66, y: 94, opacity: 0 }}
                      animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
                      <Flip7Card card={{ kind: 'action', action: 'second' }} size="xs" flip={false} />
                    </motion.div>
                  )}
                </div>
              )}

              <div className="f7-player-head">
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} />
                <div className="f7-player-id">
                  <span className="f7-player-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
                  <span className="f7-player-score">{p.score} pts</span>
                </div>
                {status === 'busted' && <span className="f7-badge bust">PERDU</span>}
                {status === 'stayed' && <span className="f7-badge stay">resté</span>}
              </div>

              <div className="f7-line">
                <AnimatePresence mode="popLayout">
                  {l?.numbers.map((v, i) => (
                    <Flip7Card key={`n${i}-${v}`} card={{ kind: 'number', value: v }} />
                  ))}
                  {l?.mods.map((m, i) => (
                    <Flip7Card key={`m${i}-${m.op}-${m.val}`} card={{ kind: 'mod', op: m.op, val: m.val }} />
                  ))}
                  {l?.bustCard && (
                    <Flip7Card key="bust" card={{ kind: 'number', value: l.bustCard.value }} bust />
                  )}
                </AnimatePresence>
                {(!l || (l.numbers.length === 0 && l.mods.length === 0 && !l.bustCard)) && <span className="f7-empty">aucune carte</span>}
              </div>

              <div className="f7-line-foot">
                <span>{l?.numbers.length || 0}/7 nombres</span>
                {g.phase !== 'playing' && p.roundResult != null
                  ? <span className="f7-round-pts">+{p.roundResult} cette manche</span>
                  : <span className="f7-cur">{l?.current ?? 0} pts en jeu</span>}
              </div>

              {/* Boutons d'action sur MA carte (sous mes points) — pas de conflit avec les cartes Stop/Chance */}
              {p.id === me && g.phase === 'playing' && g.isMyTurn && !pa && (
                <div className="f7-turn-controls">
                  <Button size="small" variant="contained" startIcon={<Hand size={16} />} onClick={() => onAction({ kind: 'hit' })}>Tirer</Button>
                  <Button size="small" variant="outlined" startIcon={<PauseCircle size={16} />} onClick={() => onAction({ kind: 'stay' })}>Rester</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {g.phase === 'roundover' && (
        <p className="muted" style={{ textAlign: 'center' }}>
          Manche suivante automatique dans {nextRoundLeft ?? 5}s…
        </p>
      )}

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

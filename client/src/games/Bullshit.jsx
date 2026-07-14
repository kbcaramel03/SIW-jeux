import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Hand, Gavel, Check } from 'lucide-react';
import PlayingCard from './PlayingCard.jsx';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti } from '../effects.js';

export default function Bullshit({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' });
  }, [g.phase, g.amSeated]);

  // On vide la sélection quand le tour / la phase change.
  useEffect(() => { setSelected([]); }, [g.turn, g.phase]);

  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) winConfetti();
  }, [g.phase]);

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Bullshit — salle d'attente</h3>
        <p className="cn-hint-text">Un jeu de bluff et de sang-froid. À votre tour, posez une ou plusieurs cartes face cachée en annonçant le rang demandé : libre à vous de dire la vérité ou de mentir. Si quelqu'un doute, il vous conteste — le menteur démasqué ramasse toute la pile, mais une accusation à tort se paie aussi. La première à se débarrasser de toutes ses cartes gagne. De 2 à 8 joueuses.</p>
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
        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 3 joueuses…</p>}
      </div>
    );
  }

  const opponents = g.players.filter((p) => p.id !== me);
  const lr = g.lastResult;

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  }
  function playSelected() {
    if (selected.length < 1) return;
    onAction({ kind: 'play', cardIds: selected });
    setSelected([]);
  }

  function banner() {
    if (g.phase === 'over') return g.winner === me ? '🎉 Tu as gagné !' : `${nameById[g.winner] || 'Quelqu\'un'} a gagné`;
    if (g.phase === 'challenge') {
      const who = g.lastPlay ? (g.lastPlay.by === me ? 'Tu' : nameById[g.lastPlay.by]) : '?';
      const verb = g.lastPlay?.by === me ? 'as annoncé' : 'annonce';
      return `${who} ${verb} ${g.lastPlay?.count} × ${g.lastPlay?.claim} — on conteste ?`;
    }
    if (g.isMyTurn) return `À toi : annonce des ${g.currentRank}`;
    return `Au tour de ${nameById[g.turn] || '?'} (des ${g.currentRank})`;
  }

  return (
    <div className="bsh fade-up">
      {/* Table ronde : adversaires en arc autour du centre, cartes face cachée en éventail */}
      <div className="bsh-table">
        {opponents.map((p, i) => {
          const n = opponents.length;
          const t = n === 1 ? 0.5 : i / (n - 1);
          const ang = ((150 - 120 * t) * Math.PI) / 180; // arc sur la moitié haute
          const x = 50 + Math.cos(ang) * 44;
          const y = 40 - Math.sin(ang) * 30;
          const fanRot = 180 + (x - 50) * 0.5; // l'éventail s'ouvre vers le tapis
          const fan = Math.min(p.count, 7);
          return (
            <div key={p.id} className={`bsh-opp ${g.turn === p.id ? 'active' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="bsh-opp-info">
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={26} />
                <span className="bsh-opp-name">{nameById[p.id] || '?'}</span>
                <span className="bsh-count">{p.count}</span>
              </div>
              <div className="bsh-opp-fan" style={{ transform: `rotate(${fanRot}deg)` }}>
                {Array.from({ length: fan }).map((_, j) => {
                  const rot = fan === 1 ? 0 : -22 + (44 / (fan - 1)) * j;
                  return (
                    <div key={j} className="bsh-fan-card" style={{ transform: `rotate(${rot}deg)` }}>
                      <PlayingCard faceDown size="mini" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Centre : rang imposé + pile */}
        <div className="bsh-center">
          <div className="bsh-rank">
            <span className="bsh-rank-label">Rang imposé</span>
            <span className="bsh-rank-value">{g.currentRank}</span>
          </div>
          <div className="bsh-pile">
            {g.pileCount === 0
              ? <div className="bsh-pile-empty">pile vide</div>
              : Array.from({ length: Math.min(g.pileCount, 5) }).map((_, i) => (
                <div key={i} className="bsh-pile-card" style={{ transform: `translate(${i * 2}px, ${i * -2}px) rotate(${(i - 2) * 3}deg)` }}>
                  <PlayingCard faceDown size="md" />
                </div>
              ))}
            {g.pileCount > 0 && <span className="bsh-pile-count">{g.pileCount}</span>}
          </div>
        </div>
      </div>

      {/* Bannière */}
      <div className={`bsh-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner()}</div>

      {/* Révélation après contestation */}
      <AnimatePresence>
        {lr && (
          <motion.div className={`bsh-reveal ${lr.wasBluff ? 'bluff' : 'honest'}`}
            initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="bsh-reveal-msg">
              {lr.wasBluff
                ? `Bluff ! ${nameById[lr.by] || 'Quelqu\'un'} annonçait des ${lr.claim} → ${nameById[lr.loser] || '?'} ramasse ${lr.picked} carte(s).`
                : `Honnête ! C'était bien des ${lr.claim} → ${nameById[lr.challenger] || '?'} se trompe et ramasse ${lr.picked} carte(s).`}
            </div>
            <div className="bsh-reveal-cards">
              {lr.revealed.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contrôles de contestation */}
      {g.phase === 'challenge' && (g.canChallenge || g.canPass) && (
        <div className="cn-controls bsh-controls">
          {g.canChallenge && <Button variant="contained" color="error" startIcon={<Gavel size={18} />} onClick={() => onAction({ kind: 'challenge' })}>Bullshit !</Button>}
          {g.canPass && <Button variant="outlined" startIcon={<Check size={18} />} onClick={() => onAction({ kind: 'pass' })}>J'accepte (à moi de jouer)</Button>}
        </div>
      )}

      {/* Ma main */}
      <div className="bsh-hand">
        <AnimatePresence mode="popLayout">
          {g.myHand.map((card) => (
            <motion.div key={card.id} layout
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="bsh-hand-card">
              <PlayingCard card={card} size="md" selected={selected.includes(card.id)}
                onClick={g.isMyTurn ? () => toggle(card.id) : undefined} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Jouer */}
      {g.isMyTurn && (
        <div className="cn-controls bsh-controls">
          <Button variant="contained" startIcon={<Hand size={18} />} disabled={selected.length < 1} onClick={playSelected}>
            {selected.length < 1 ? `Choisis des cartes à annoncer comme des ${g.currentRank}` : `Annoncer ${selected.length} × ${g.currentRank}`}
          </Button>
        </div>
      )}

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

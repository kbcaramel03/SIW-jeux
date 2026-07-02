import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Fish, Trophy, MessageCircleQuestion } from 'lucide-react';
import GoFishCard, { SPECIES } from './GoFishCard.jsx';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

export default function GoFish({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [pickedRank, setPickedRank] = useState(null);
  const lastSeq = useRef(g.lastAction?.seq || 0);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setPickedRank(null); }, [g.turn, g.isMyTurn]);
  useEffect(() => {
    const a = g.lastAction;
    if (!a || a.seq === lastSeq.current) return;
    lastSeq.current = a.seq;
    if (a.kind === 'book') boomSound(); else popSound();
  }, [g.lastAction?.seq]);
  useEffect(() => { if (g.phase === 'over' && g.winner === me) winConfetti(); }, [g.phase]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Fish size={20} color="#2b7fd4" /> Go Fish — salle d'attente</h3>
        <p className="cn-hint-text">Un jeu de collection et de mémoire. À votre tour, demandez à une autre joueuse toutes ses cartes d'une espèce que vous possédez déjà. Si elle en a, elle vous les donne et vous rejouez ; sinon, allez « à la pêche » dans la pioche. Réunissez les quatre cartes d'une même espèce pour former une famille : la joueuse avec le plus de familles l'emporte. De 2 à 6 joueuses.</p>
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

  const picking = g.isMyTurn && !!pickedRank;
  function ask(targetId) {
    if (!picking) return;
    onAction({ kind: 'ask', targetId, rank: pickedRank });
    setPickedRank(null);
  }

  function banner() {
    if (g.phase === 'over') {
      if (g.winner === 'tie') return '🤝 Égalité parfaite !';
      return g.winner === me ? 'Tu gagnes avec le plus de familles !' : `${nameById[g.winner] || '?'} gagne la partie`;
    }
    const a = g.lastAction;
    const sp = a && SPECIES[a.rank] ? SPECIES[a.rank].name : '';
    if (a && a.kind === 'got') return `${a.by === me ? 'Tu prends' : `${nameById[a.by]} prend`} ${a.count} ${sp} à ${a.target === me ? 'toi' : nameById[a.target]}`;
    if (a && a.kind === 'fish') return `${a.by === me ? 'Tu vas' : `${nameById[a.by]} va`} à la pêche…${a.drawnRank ? ` et pioche un ${SPECIES[a.drawnRank]?.name} !` : ''}`;
    if (a && a.kind === 'book') return `Famille de ${sp} complétée par ${a.by === me ? 'toi' : nameById[a.by]} !`;
    return g.isMyTurn ? 'À toi de jouer' : `Au tour de ${nameById[g.turn] || '?'}`;
  }

  const n = g.players.length;
  const myBooks = g.players.find((p) => p.id === me)?.books || [];
  const asked = g.lastAction && ['got', 'fish'].includes(g.lastAction.kind) ? g.lastAction : null;

  return (
    <div className="gf fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner()}</div>
      {asked && (
        <div className="gf-asked">
          <MessageCircleQuestion size={16} />
          <span><b>{asked.by === me ? 'Tu' : nameById[asked.by]}</b> a demande <b>{SPECIES[asked.rank]?.name}</b> a <b>{asked.target === me ? 'toi' : nameById[asked.target]}</b></span>
          <GoFishCard rank={asked.rank} size="sm" />
        </div>
      )}

      {/* Table ronde : toutes les joueuses en cercle, le tour suit le cercle */}
      <div className="gf-table">
        {g.players.map((p, i) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 41;
          const y = 50 + Math.sin(ang) * 43;
          const isMe = p.id === me;
          const askable = picking && !isMe;
          return (
            <button key={p.id} className={`gf-seat ${g.turn === p.id ? 'active' : ''} ${askable ? 'askable' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }} disabled={!askable} onClick={() => ask(p.id)}>
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={42} />
              <span className="gf-seat-name">{nameById[p.id] || '?'}{isMe ? ' (toi)' : ''}</span>
              <span className="gf-seat-meta">{p.count} 🂠{p.books.length > 0 && <b> · {p.books.length} 👑</b>}</span>
            </button>
          );
        })}
        {/* Pioche au centre */}
        <div className="gf-pool">
          <GoFishCard faceDown size="md" />
          <span className="gf-pool-count">{g.poolCount}</span>
        </div>
      </div>

      {picking && <p className="gf-hint">Touche une joueuse à qui demander des <b>{SPECIES[pickedRank]?.name}</b></p>}

      {/* Mes familles complétées */}
      {myBooks.length > 0 && (
        <div className="gf-mybooks">
          <span className="gf-mybooks-label"><Trophy size={14} /> Tes familles :</span>
          {myBooks.map((r) => <span key={r} className="gf-book-chip">{SPECIES[r]?.emoji} {SPECIES[r]?.name}</span>)}
        </div>
      )}

      {/* Ma main : on tape une carte pour choisir l'espèce à demander */}
      <div className="gf-hand">
        <AnimatePresence mode="popLayout">
          {g.myHand.map((card) => (
            <motion.div key={card.id} layout
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }} className="gf-hand-card">
              <GoFishCard rank={card.rank} size="md" selected={pickedRank === card.rank}
                dim={pickedRank && pickedRank !== card.rank} onClick={g.isMyTurn ? () => setPickedRank(card.rank) : undefined} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {g.isMyTurn && !pickedRank && <p className="muted" style={{ textAlign: 'center' }}>Choisis une carte : tu demanderas cette espèce à une autre joueuse.</p>}
      {!g.isMyTurn && g.phase === 'playing' && <p className="muted" style={{ textAlign: 'center' }}>En attente de {nameById[g.turn] || '?'}…</p>}

      {/* Classement de fin */}
      {g.phase === 'over' && (
        <div className="gf-over">
          <div className="gf-ranking">
            {g.players.slice().sort((a, b) => b.books.length - a.books.length).map((p) => (
              <div key={p.id} className={`gf-rank-row ${p.id === g.winner ? 'win' : ''}`}>
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={24} />
                <b>{nameById[p.id] || '?'}</b>
                <span>{p.books.length} famille{p.books.length > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
          {isHost && <Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button>}
        </div>
      )}
    </div>
  );
}

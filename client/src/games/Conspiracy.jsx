import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Crown, Check, X, ShieldCheck, Skull, Users, Vote, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { FaUserSecret } from 'react-icons/fa';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, boomSound, popSound } from '../effects.js';

// Le Complot — ambiance « salle de crise » : panneau sombre, médaillons de
// mission, tampons de vote et cartes à jouer Succès/Sabotage.
export default function Conspiracy({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [picked, setPicked] = useState([]);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setPicked([]); }, [g.phase, g.missionNo]);
  useEffect(() => {
    if (g.phase === 'over' && ((g.winner === 'spies' && g.myRole === 'spy') || (g.winner === 'society' && g.myRole === 'society'))) winConfetti();
  }, [g.phase]);
  // Petit son au verdict de chaque mission.
  useEffect(() => {
    if (g.phase === 'reveal') { if (g.lastReveal?.outcome === 'fail') boomSound(); else popSound(); }
  }, [g.phase]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><FaUserSecret style={{ color: '#b42337' }} /> Le Complot — salle d'attente</h3>
        <p className="cn-hint-text">La Société veut réussir 3 missions ; les Espions infiltrés veulent en saboter 3 sans se faire griller.
          Le chef propose une équipe (jamais lui-même), tout le monde vote — 4 équipes rejetées et les Espions gagnent ! (4 à 8 joueuses)</p>
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
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 4 joueuses…</p>}
      </div>
    );
  }

  const successCount = g.results.filter((r) => r === 'success').length;
  const failCount = g.results.filter((r) => r === 'fail').length;
  const isSpy = g.myRole === 'spy';

  function togglePick(id) {
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= g.teamSize ? s : [...s, id]));
  }

  function banner() {
    if (g.phase === 'over') {
      const iWon = (g.winner === 'spies' && g.myRole === 'spy') || (g.winner === 'society' && g.myRole === 'society');
      const why = g.lastReveal?.rejected ? ' — 4 équipes rejetées !' : '';
      return `${g.winner === 'spies' ? '🕵️ Les Espions gagnent' : '🛡️ La Société gagne'}${why} ${iWon ? '· Tu gagnes 🎉' : '· Tu perds'}`;
    }
    if (g.phase === 'reveal') {
      return g.lastReveal?.outcome === 'success'
        ? `✅ Mission réussie — ${g.lastReveal?.fails || 0} sabotage`
        : `💥 Mission sabotée — ${g.lastReveal?.fails || 0} sabotage(s)`;
    }
    if (g.phase === 'team') return g.isLeader ? `À toi, chef : choisis ${g.teamSize} agents` : `${nameById[g.leader] || '?'} compose l'équipe (${g.teamSize} agents)`;
    if (g.phase === 'vote') return g.hasVoted ? `Vote en cours… ${g.votedCount}/${g.seats.length}` : 'Approuves-tu cette équipe ?';
    if (g.phase === 'mission') return g.amOnTeam ? 'Mission : joue ta carte en secret' : `Mission en cours… ${g.submittedCount}/${g.team.length} cartes jouées`;
    return '';
  }

  return (
    <div className="csp2 fade-up">
      {/* Piste des 5 missions : médaillons reliés */}
      <div className="csp2-track">
        {(g.teamSizes || [2, 3, 3, 4, 4]).map((sz, i) => {
          const res = g.results[i];
          const current = i === g.missionNo - 1 && g.phase !== 'over';
          const dbl = i === 3 && g.seats.length >= 7;
          return (
            <div key={i} className="csp2-step">
              {i > 0 && <span className="csp2-link" />}
              <motion.div
                className={`csp2-medal ${res || ''} ${current ? 'current' : ''}`}
                initial={false}
                animate={res ? { scale: [1.35, 1], rotate: [8, 0] } : {}}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                {res === 'success' ? <ShieldCheck size={22} />
                  : res === 'fail' ? <Skull size={22} />
                    : <><span className="csp2-medal-no">{i + 1}</span><span className="csp2-medal-sz">{sz} ag.</span></>}
                {dbl && !res && <span className="csp2-dbl" title="2 sabotages requis">××2</span>}
              </motion.div>
            </div>
          );
        })}
        <div className="csp2-score">
          <span className="s">{successCount}</span>
          <span className="sep">—</span>
          <span className="f">{failCount}</span>
        </div>
      </div>

      {/* Mon rôle (carte d'identité secrète) */}
      <motion.div className={`csp2-role ${isSpy ? 'spy' : 'society'}`}
        initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
        <span className="csp2-role-icon">{isSpy ? <FaUserSecret /> : <ShieldCheck />}</span>
        <span className="csp2-role-text">
          {isSpy
            ? <>Tu es un <b>Espion</b>{g.spies?.length > 1 && <span className="csp2-fellows"> · complices : {g.spies.filter((s) => s !== me).map((s) => nameById[s]).join(', ')}</span>}</>
            : <>Tu es dans la <b>Société</b> · <Eye size={13} style={{ verticalAlign: '-2px' }} /> {g.spyCount} espion(s) parmi vous</>}
        </span>
      </motion.div>

      {/* Bannière de phase */}
      <AnimatePresence mode="wait">
        <motion.div key={banner()} className={`csp2-banner ${g.phase === 'reveal' ? (g.lastReveal?.outcome === 'fail' ? 'bad' : 'good') : ''} ${g.phase === 'over' ? (g.winner === 'spies' ? 'bad' : 'good') : ''}`}
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }}>
          {banner()}
        </motion.div>
      </AnimatePresence>

      {/* Équipes rejetées (tampons) */}
      {g.phase !== 'over' && (
        <div className="csp2-rejects">
          <span>Équipes rejetées</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`csp2-reject-dot ${i < g.rejectStreak ? 'on' : ''}`}>{i < g.rejectStreak ? '✗' : ''}</span>
          ))}
          <span className="hint">4 = victoire des Espions</span>
        </div>
      )}

      {/* Agents (joueuses) */}
      <div className="csp2-players">
        {g.players.map((p) => {
          const onTeam = g.team.includes(p.id);
          const isPicked = picked.includes(p.id);
          const voteIcon = g.lastVote && (g.phase === 'team' || g.phase === 'mission' || g.phase === 'reveal')
            ? (g.lastVote.approve.includes(p.id) ? 'up' : g.lastVote.reject.includes(p.id) ? 'down' : null) : null;
          // Règle du Complot : le chef ne peut pas se choisir lui-même.
          const clickable = g.isLeader && g.phase === 'team' && p.id !== me;
          return (
            <motion.button key={p.id} layout
              className={`csp2-player ${onTeam ? 'team' : ''} ${isPicked ? 'picked' : ''} ${clickable ? 'pick' : ''}`}
              disabled={!clickable} onClick={() => clickable && togglePick(p.id)}
              whileTap={clickable ? { scale: 0.94 } : {}}>
              {g.leader === p.id && <span className="csp2-chief"><Crown size={11} /> CHEF</span>}
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={38} />
              <span className="csp2-player-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              <AnimatePresence>
                {voteIcon && (
                  <motion.span key={voteIcon} className={`csp2-stamp ${voteIcon}`}
                    initial={{ scale: 2.2, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                    {voteIcon === 'up' ? 'POUR' : 'CONTRE'}
                  </motion.span>
                )}
              </AnimatePresence>
              {(onTeam || isPicked) && (
                <motion.span className="csp2-onteam" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Users size={11} /> mission
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Contrôles selon la phase */}
      {g.phase === 'team' && g.isLeader && (
        <div className="csp2-actions column">
          <Button variant="contained" startIcon={<Users size={18} />} disabled={picked.length !== g.teamSize}
            onClick={() => onAction({ kind: 'propose', team: picked })}
            sx={{ background: 'linear-gradient(120deg,#c8a24a,#9d7a2a)', fontWeight: 700 }}>
            Envoyer cette équipe en mission ({picked.length}/{g.teamSize})
          </Button>
          <span className="csp2-hint">Touche tes agents ci-dessus — tu ne peux pas te choisir toi-même.</span>
        </div>
      )}

      {g.phase === 'vote' && !g.hasVoted && (
        <div className="csp2-actions">
          <motion.button className="csp2-votecard yes" whileHover={{ y: -5 }} whileTap={{ scale: 0.95 }}
            onClick={() => onAction({ kind: 'vote', approve: true })}>
            <ThumbsUp size={26} /><b>POUR</b><span>j'approuve l'équipe</span>
          </motion.button>
          <motion.button className="csp2-votecard no" whileHover={{ y: -5 }} whileTap={{ scale: 0.95 }}
            onClick={() => onAction({ kind: 'vote', approve: false })}>
            <ThumbsDown size={26} /><b>CONTRE</b><span>je rejette l'équipe</span>
          </motion.button>
        </div>
      )}
      {g.phase === 'vote' && g.hasVoted && <p className="csp2-wait">🗳️ Ton vote est dans l'urne — on attend les autres…</p>}

      {g.phase === 'mission' && g.amOnTeam && !g.hasSubmitted && (
        <div className="csp2-actions">
          <motion.button className="csp2-playcard success" whileHover={{ y: -6, rotate: -2 }} whileTap={{ scale: 0.95 }}
            onClick={() => onAction({ kind: 'card', value: 'success' })}>
            <ShieldCheck size={30} /><b>SUCCÈS</b>
          </motion.button>
          {isSpy && (
            <motion.button className="csp2-playcard fail" whileHover={{ y: -6, rotate: 2 }} whileTap={{ scale: 0.95 }}
              onClick={() => onAction({ kind: 'card', value: 'fail' })}>
              <Skull size={30} /><b>SABOTER</b>
            </motion.button>
          )}
        </div>
      )}
      {g.phase === 'mission' && g.amOnTeam && g.hasSubmitted && <p className="csp2-wait">🂠 Carte jouée — on attend les autres…</p>}

      {/* Dépouillement : cartes anonymes retournées une à une */}
      {g.phase === 'reveal' && !g.lastReveal?.rejected && (
        <div className="csp2-reveal">
          {Array.from({ length: (g.team.length || 0) }, (_, i) => {
            const isFail = i < (g.lastReveal?.fails || 0);
            return (
              <motion.div key={i} className={`csp2-reveal-card ${isFail ? 'fail' : 'success'}`}
                initial={{ rotateY: 180, opacity: 0, y: 14 }} animate={{ rotateY: 0, opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.45, type: 'spring', stiffness: 160, damping: 15 }}>
                {isFail ? <Skull size={26} /> : <ShieldCheck size={26} />}
                <span>{isFail ? 'SABOTAGE' : 'SUCCÈS'}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      {g.phase === 'reveal' && isHost && (
        <div className="csp2-actions column">
          <Button variant="contained" startIcon={<Vote size={18} />} onClick={() => onAction({ kind: 'next' })}>Mission suivante</Button>
        </div>
      )}
      {g.phase === 'reveal' && !isHost && <p className="csp2-wait">En attente de l'hôte…</p>}

      {g.phase === 'over' && isHost && (
        <div className="csp2-actions column">
          <Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button>
        </div>
      )}
    </div>
  );
}

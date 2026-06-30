import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@mui/material';
import { Play, Sparkles, Crown, Check, X, ShieldCheck, Skull, Users, Vote, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { FaUserSecret } from 'react-icons/fa';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, boomSound, popSound } from '../effects.js';

// Le Complot — ambiance « salle de crise », joueuses autour d'une table ronde.
export default function Conspiracy({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [picked, setPicked] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setPicked([]); }, [g.phase, g.missionNo]);
  useEffect(() => {
    if (g.phase === 'over' && ((g.winner === 'spies' && g.myRole === 'spy') || (g.winner === 'society' && g.myRole === 'society'))) winConfetti();
  }, [g.phase]);
  useEffect(() => {
    if (g.phase === 'reveal') { if (g.lastReveal?.outcome === 'fail') boomSound(); else popSound(); }
  }, [g.phase]);
  useEffect(() => {
    if (g.phase !== 'vote' || !g.voteDeadline) return undefined;
    const t = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(t);
  }, [g.phase, g.voteDeadline]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><FaUserSecret style={{ color: '#b42337' }} /> Le Complot — salle d'attente</h3>
        <p className="cn-hint-text">Deux camps s'affrontent en secret. La Société doit mener à bien trois missions ; les Espions infiltrés cherchent à en saboter trois sans se faire démasquer. À chaque tour, un chef propose une équipe — jamais lui-même — que tout le monde approuve ou rejette ; les membres envoyés décident ensuite, en secret, de faire réussir ou échouer la mission. Quatre équipes rejetées d'affilée et les Espions l'emportent. De 4 à 8 joueuses.</p>
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
  const voteLeft = g.phase === 'vote' && g.voteDeadline ? Math.max(0, Math.ceil((g.voteDeadline - now) / 1000)) : null;
  const missionDetails = selectedMission != null ? g.missionLog?.[selectedMission] : null;

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
      // On NE révèle PAS le nombre de sabotages : juste réussi ou saboté.
      return g.lastReveal?.outcome === 'success' ? '✅ Mission réussie !' : '💥 Mission sabotée !';
    }
    if (g.phase === 'team') return g.isLeader ? `À toi, chef : choisis ${g.teamSize} agents` : `${nameById[g.leader] || '?'} compose l'équipe (${g.teamSize} agents)`;
    if (g.phase === 'vote') return g.hasVoted ? `Vote en cours… ${g.votedCount}/${g.seats.length}` : 'Approuves-tu cette équipe ?';
    if (g.phase === 'mission') return g.amOnTeam ? 'Mission : choisis en secret' : 'Mission en cours…';
    return '';
  }

  // Icône de vote affichée sur chaque siège après un dépouillement.
  const voteIconFor = (id) => {
    if (g.phase === 'vote' && g.votes && g.votes[id] != null) return g.votes[id] ? 'up' : 'down';
    if (g.lastVote && (g.phase === 'team' || g.phase === 'mission' || g.phase === 'reveal')) {
      return g.lastVote.approve.includes(id) ? 'up' : g.lastVote.reject.includes(id) ? 'down' : null;
    }
    return null;
  };

  const n = g.players.length;

  return (
    <div className="csp2 fade-up">
      {/* Piste des 5 missions : médaillons reliés */}
      <div className="csp2-track">
        {(g.teamSizes || [2, 3, 3, 4, 4]).map((sz, i) => {
          const res = g.results[i];
          const current = i === g.missionNo - 1 && g.phase !== 'over';
          return (
            <div key={i} className="csp2-step">
              {i > 0 && <span className="csp2-link" />}
              <motion.button
                type="button"
                className={`csp2-medal ${res || ''} ${current ? 'current' : ''}`}
                disabled={!res}
                onClick={() => res && setSelectedMission(i)}
                initial={false}
                animate={res ? { scale: [1.35, 1], rotate: [8, 0] } : {}}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                {res === 'success' ? <ShieldCheck size={22} />
                  : res === 'fail' ? <Skull size={22} />
                    : <><span className="csp2-medal-no">{i + 1}</span><span className="csp2-medal-sz">{sz} ag.</span></>}
              </motion.button>
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
      {voteLeft != null && (
        <div className={`csp2-timer ${voteLeft <= 10 ? 'hot' : ''}`}>
          Vote public · {voteLeft}s
        </div>
      )}

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

      {/* Table ronde : les agents en cercle, le chef au centre */}
      <div className="csp2-table">
        {g.players.map((p, i) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 41;
          const y = 50 + Math.sin(ang) * 42;
          const onTeam = g.team.includes(p.id);
          const isPicked = picked.includes(p.id);
          const vIcon = voteIconFor(p.id);
          // Règle du Complot : le chef ne peut pas se choisir lui-même.
          const clickable = g.isLeader && g.phase === 'team' && p.id !== me;
          return (
            <motion.button key={p.id} layout
              className={`csp2-seat ${onTeam ? 'team' : ''} ${isPicked ? 'picked' : ''} ${clickable ? 'pick' : ''} ${g.leader === p.id ? 'chief' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              disabled={!clickable} onClick={() => clickable && togglePick(p.id)}
              whileTap={clickable ? { scale: 0.92 } : {}}>
              {g.leader === p.id && <span className="csp2-chief-badge"><Crown size={11} /></span>}
              <div className="csp2-seat-av">
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={40} />
                {(onTeam || isPicked) && <span className="csp2-seat-team"><Users size={11} /></span>}
              </div>
              <span className="csp2-seat-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              <AnimatePresence>
                {vIcon && (
                  <motion.span key={vIcon} className={`csp2-stamp ${vIcon}`}
                    initial={{ scale: 2.2, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                    {vIcon === 'up' ? 'POUR' : 'CONTRE'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
        {/* Centre de la table : dossier de mission */}
        <div className="csp2-table-center">
          <FaUserSecret />
          <span className="csp2-table-mission">Mission {g.missionNo}</span>
          <span className="csp2-table-size">{g.teamSize} agents</span>
        </div>
      </div>

      {/* Contrôles selon la phase */}
      {g.phase === 'team' && g.isLeader && (
        <div className="csp2-actions column">
          <Button variant="contained" startIcon={<Users size={18} />} disabled={picked.length !== g.teamSize}
            onClick={() => onAction({ kind: 'propose', team: picked })}
            sx={{ background: 'linear-gradient(120deg,#c8a24a,#9d7a2a)', fontWeight: 700 }}>
            Envoyer cette équipe en mission ({picked.length}/{g.teamSize})
          </Button>
          <span className="csp2-hint">Touche tes agents autour de la table — tu ne peux pas te choisir toi-même.</span>
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
      {g.phase === 'mission' && g.amOnTeam && g.hasSubmitted && <p className="csp2-wait">En attente des autres…</p>}

      {/* Dépouillement : verdict SANS le nombre de sabotages */}
      {g.phase === 'reveal' && !g.lastReveal?.rejected && (
        <motion.div className={`csp2-verdict ${g.lastReveal?.outcome === 'fail' ? 'fail' : 'success'}`}
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
          {g.lastReveal?.outcome === 'fail' ? <Skull size={34} /> : <ShieldCheck size={34} />}
          <b>{g.lastReveal?.outcome === 'fail' ? 'MISSION SABOTÉE' : 'MISSION RÉUSSIE'}</b>
          <span>quelqu'un a-t-il trahi ? mystère…</span>
        </motion.div>
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

      <AnimatePresence>
        {missionDetails && (
          <motion.div className="csp2-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedMission(null)}>
            <motion.div className="csp2-modal" initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 10 }}
              onClick={(e) => e.stopPropagation()}>
              <b>Mission {missionDetails.missionNo}</b>
              <span className={`csp2-modal-result ${missionDetails.outcome}`}>
                {missionDetails.outcome === 'success' ? 'Succès' : 'Échec'}
              </span>
              <div className="csp2-modal-team">
                {missionDetails.team.map((id) => (
                  <span key={id} className="csp2-modal-agent">
                    <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
                    {nameById[id] || '?'}
                  </span>
                ))}
              </div>
              <Button size="small" onClick={() => setSelectedMission(null)}>Fermer</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

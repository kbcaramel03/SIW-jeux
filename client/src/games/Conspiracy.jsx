import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Crown, Check, X, ShieldCheck, Skull, Users, Vote } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti } from '../effects.js';

export default function Conspiracy({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const nameById = Object.fromEntries(room.players.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(room.players.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(room.players.map((p) => [p.id, p.avatar]));
  const [picked, setPicked] = useState([]);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setPicked([]); }, [g.phase, g.missionNo]);
  useEffect(() => {
    if (g.phase === 'over' && ((g.winner === 'spies' && g.myRole === 'spy') || (g.winner === 'society' && g.myRole === 'society'))) winConfetti();
  }, [g.phase]);

  // ---- Salle d'attente ----
  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Conspiracy — salle d'attente</h3>
        <p className="cn-hint-text">La Société veut réussir 3 missions ; les Espions infiltrés veulent en saboter 3 sans se faire griller. Bluff, votes et déduction ! (4 à 8 joueurs)</p>
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
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 4 joueurs…</p>}
      </div>
    );
  }

  const successCount = g.results.filter((r) => r === 'success').length;
  const failCount = g.results.filter((r) => r === 'fail').length;

  function togglePick(id) {
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= g.teamSize ? s : [...s, id]));
  }

  function banner() {
    if (g.phase === 'over') {
      const iWon = (g.winner === 'spies' && g.myRole === 'spy') || (g.winner === 'society' && g.myRole === 'society');
      return `${g.winner === 'spies' ? 'Les Espions' : 'La Société'} gagnent — ${iWon ? 'tu gagnes 🎉' : 'tu perds'}`;
    }
    if (g.phase === 'reveal') {
      if (g.lastReveal?.random) return `3 rejets : mission ${g.lastReveal.outcome === 'success' ? 'réussie' : 'sabotée'} au hasard !`;
      return `Mission ${g.lastReveal?.outcome === 'success' ? 'RÉUSSIE' : 'SABOTÉE'} — ${g.lastReveal?.fails || 0} sabotage(s)`;
    }
    if (g.phase === 'team') return g.isLeader ? `À toi de former l'équipe (${g.teamSize})` : `${nameById[g.leader] || '?'} forme l'équipe (${g.teamSize})`;
    if (g.phase === 'vote') return g.hasVoted ? `Votes en cours… (${g.votedCount}/${g.seats.length})` : 'Vote l\'équipe proposée';
    if (g.phase === 'mission') return g.amOnTeam ? 'Mission : joue ta carte en secret' : `Mission en cours… (${g.submittedCount}/${g.team.length})`;
    return '';
  }

  return (
    <div className="csp fade-up">
      {/* Piste des missions */}
      <div className="csp-track">
        {(g.teamSizes || [2, 3, 3, 4, 4]).map((sz, i) => {
          const res = g.results[i];
          const current = i === g.missionNo - 1 && g.phase !== 'over';
          return (
            <div key={i} className={`csp-mission ${res || ''} ${current ? 'current' : ''}`}>
              <span className="csp-mission-no">{i + 1}</span>
              <span className="csp-mission-sz">{sz}{(i === 3 && g.seats.length >= 7) ? '••' : ''}</span>
            </div>
          );
        })}
        <div className="csp-score"><span className="s">{successCount}</span>/<span className="f">{failCount}</span></div>
      </div>

      {/* Mon rôle */}
      <div className={`csp-role ${g.myRole}`}>
        {g.myRole === 'spy'
          ? <><Skull size={16} /> Tu es un <b>Espion</b>{g.spies?.length > 1 && <> · avec {g.spies.filter((s) => s !== me).map((s) => nameById[s]).join(', ')}</>}</>
          : <><ShieldCheck size={16} /> Tu es dans la <b>Société</b> · {g.spyCount} espion(s) caché(s)</>}
      </div>

      {/* Bannière de phase */}
      <div className={`csp-banner ${g.phase === 'reveal' && g.lastReveal?.outcome === 'fail' ? 'bad' : ''} ${g.phase === 'reveal' && g.lastReveal?.outcome === 'success' ? 'good' : ''}`}>{banner()}</div>

      {/* Rejets d'affilée */}
      {g.phase !== 'over' && (
        <div className="csp-rejects">Rejets d'affilée : {[0, 1, 2].map((i) => <span key={i} className={`dot ${i < g.rejectStreak ? 'on' : ''}`} />)} <span className="muted">(3 → mission au hasard)</span></div>
      )}

      {/* Joueurs */}
      <div className="csp-players">
        {g.players.map((p) => {
          const onTeam = g.team.includes(p.id);
          const isPicked = picked.includes(p.id);
          const voteIcon = g.lastVote && (g.phase === 'team' || g.phase === 'mission' || g.phase === 'reveal')
            ? (g.lastVote.approve.includes(p.id) ? 'up' : g.lastVote.reject.includes(p.id) ? 'down' : null) : null;
          const clickable = g.isLeader && g.phase === 'team';
          return (
            <button key={p.id} className={`csp-player ${onTeam ? 'team' : ''} ${isPicked ? 'picked' : ''}`}
              disabled={!clickable} onClick={() => clickable && togglePick(p.id)}>
              {g.leader === p.id && <Crown size={14} className="csp-leader" color="#c2a36b" />}
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={34} />
              <span className="csp-player-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              {voteIcon === 'up' && <span className="csp-vote up"><Check size={13} /></span>}
              {voteIcon === 'down' && <span className="csp-vote down"><X size={13} /></span>}
              {onTeam && <span className="csp-onteam"><Users size={12} /></span>}
            </button>
          );
        })}
      </div>

      {/* Contrôles selon la phase */}
      {g.phase === 'team' && g.isLeader && (
        <div className="cn-controls">
          <Button variant="contained" startIcon={<Users size={18} />} disabled={picked.length !== g.teamSize}
            onClick={() => onAction({ kind: 'propose', team: picked })}>
            Proposer l'équipe ({picked.length}/{g.teamSize})
          </Button>
        </div>
      )}

      {g.phase === 'vote' && !g.hasVoted && (
        <div className="cn-controls">
          <Button variant="contained" color="success" startIcon={<Check size={18} />} onClick={() => onAction({ kind: 'vote', approve: true })}>Pour</Button>
          <Button variant="contained" color="error" startIcon={<X size={18} />} onClick={() => onAction({ kind: 'vote', approve: false })}>Contre</Button>
        </div>
      )}

      {g.phase === 'mission' && g.amOnTeam && !g.hasSubmitted && (
        <div className="cn-controls">
          <Button variant="contained" color="success" startIcon={<ShieldCheck size={18} />} onClick={() => onAction({ kind: 'card', value: 'success' })}>Succès</Button>
          {g.myRole === 'spy' && <Button variant="contained" color="error" startIcon={<Skull size={18} />} onClick={() => onAction({ kind: 'card', value: 'fail' })}>Saboter</Button>}
        </div>
      )}
      {g.phase === 'mission' && g.amOnTeam && g.hasSubmitted && <p className="muted" style={{ textAlign: 'center' }}>Carte jouée — on attend les autres…</p>}

      {g.phase === 'reveal' && isHost && (
        <div className="cn-controls"><Button variant="contained" startIcon={<Vote size={18} />} onClick={() => onAction({ kind: 'next' })}>Mission suivante</Button></div>
      )}
      {g.phase === 'reveal' && !isHost && <p className="muted" style={{ textAlign: 'center' }}>En attente de l'hôte…</p>}

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@mui/material';
import { Play, Sparkles, Minus, Plus, Volume2, VolumeX, Skull, Vote } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GiWerewolf, GiFarmer, GiCrystalBall, GiCauldron, GiWinchesterRifle, GiWizardFace, GiMoon, GiCupidonArrow, GiShield, GiAngelWings, GiBabyFace } from 'react-icons/gi';
import { Avatar } from '../components/OnlineRail.jsx';
import { speak, stopSpeak } from '../voice.js';
import { winConfetti } from '../effects.js';

// Cartes de rôles illustrées (dessins : Game Icons / game-icons.net, CC BY 3.0).
const ROLE = {
  loup: { label: 'Loup-Garou', Icon: GiWerewolf, cls: 'loup', desc: 'Chaque nuit, dévore un villageois avec les autres loups. Gagne si les loups dominent.' },
  villageois: { label: 'Villageois', Icon: GiFarmer, cls: 'villageois', desc: 'Aucun pouvoir, juste ta ruse. Démasque les loups au vote du jour.' },
  voyante: { label: 'Voyante', Icon: GiCrystalBall, cls: 'voyante', desc: 'Chaque nuit, découvre le rôle d\'une personne de ton choix.' },
  sorciere: { label: 'Sorcière', Icon: GiCauldron, cls: 'sorciere', desc: 'Une potion de vie (sauver la victime), une potion de mort (éliminer quelqu\'un).' },
  chasseur: { label: 'Chasseur', Icon: GiWinchesterRifle, cls: 'chasseur', desc: 'En mourant, d\'un coup de fusil, tu emportes une personne avec toi.' },
  cupidon: { label: 'Cupidon', Icon: GiCupidonArrow, cls: 'cupidon', desc: 'La 1re nuit, tu lies deux amoureux. S\'ils restent les 2 derniers, ils gagnent ; si l\'un meurt, l\'autre aussi.' },
  garde: { label: 'Garde', Icon: GiShield, cls: 'garde', desc: 'Chaque nuit, tu protèges une personne des loups (jamais deux fois de suite la même).' },
  ange: { label: 'Ange', Icon: GiAngelWings, cls: 'ange', desc: 'Tu gagnes seul si tu es éliminé dès le premier tour. Sinon, simple villageois.' },
  enfant: { label: 'Enfant Sauvage', Icon: GiBabyFace, cls: 'enfant', desc: 'La 1re nuit, choisis un modèle. S\'il meurt, tu deviens un Loup-Garou.' },
};
const SPECIALS = ['voyante', 'sorciere', 'chasseur', 'cupidon', 'garde', 'ange', 'enfant'];

export default function LoupGarou({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players; // roster : noms conservés même après un départ
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [voiceOn, setVoiceOn] = useState(true);
  const [poisonMode, setPoisonMode] = useState(false);
  const [witchKill, setWitchKill] = useState(null);
  const [cupidPicks, setCupidPicks] = useState([]);
  const [voteSel, setVoteSel] = useState(null); // cible sélectionnée (à valider) au vote du jour
  const [, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [seerKnown, setSeerKnown] = useState({}); // ce que la voyante a vu (persistant pour elle)
  const [flash, setFlash] = useState(null); // bandeau d'ambiance au changement de phase
  const lastSay = useRef(-1);
  const prevPhase = useRef(g.phase);

  // La voyante mémorise les rôles révélés ; on réinitialise à une nouvelle partie.
  useEffect(() => { if (g.seerResult) setSeerKnown((k) => ({ ...k, [g.seerResult.targetId]: g.seerResult.role })); }, [g.seerResult?.targetId, g.seerResult?.role]);
  useEffect(() => { if (g.phase === 'setup') setSeerKnown({}); }, [g.phase]);

  // Les voix se chargent de façon asynchrone : on rafraîchit le sélecteur.
  useEffect(() => { const t = setTimeout(() => setTick(1), 700); return () => clearTimeout(t); }, []);

  useEffect(() => { if (g.phase === 'setup' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);

  // --- Minuteurs (jour / vote / pause commentée) : un seul ticker pour la phase active.
  const activeDeadline = g.phase === 'day' ? g.dayDeadline
    : g.phase === 'vote' ? (g.voteResultDeadline || g.voteDeadline)
      : g.phase === 'reveal' ? g.revealDeadline : null;
  useEffect(() => {
    if (!activeDeadline) return undefined;
    const t = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(t);
  }, [activeDeadline, g.phase]);
  const secsLeft = activeDeadline ? Math.max(0, Math.ceil((activeDeadline - now) / 1000)) : null;

  // Les fins de minuteur (vote auto, clôture, dépouillement, pauses commentées)
  // sont résolues par l'horloge du serveur : la partie avance même si tous les
  // téléphones sont verrouillés. Ici on ne fait qu'afficher le compte à rebours.

  // Narration : chaque joueur entend le MJ sur son propre appareil (chacun peut couper).
  useEffect(() => {
    if (!voiceOn) return;
    if (g.sayId != null && g.sayId !== lastSay.current) { lastSay.current = g.sayId; speak(g.say); }
  }, [g.sayId, voiceOn]);
  useEffect(() => () => stopSpeak(), []);
  useEffect(() => {
    if (g.phase === 'over' && ((g.winner === 'loups' && g.myRole === 'loup') || (g.winner === 'village' && g.myRole !== 'loup'))) winConfetti();
  }, [g.phase]);
  useEffect(() => { setPoisonMode(false); setWitchKill(null); setCupidPicks([]); setVoteSel(null); }, [g.nightStep, g.phase]);

  // Bandeau d'ambiance plein écran à chaque bascule de phase.
  useEffect(() => {
    if (g.phase === prevPhase.current) return undefined;
    prevPhase.current = g.phase;
    let f = null;
    if (g.phase === 'night') f = { icon: '🌙', text: `Nuit ${g.nightNo}`, cls: 'night' };
    else if (g.phase === 'reveal') f = g.resumeTo === 'day'
      ? { icon: '🌅', text: 'Le jour se lève', cls: 'dawn' }
      : { icon: '⚖️', text: 'Le verdict tombe', cls: 'dusk' };
    else if (g.phase === 'day') f = { icon: '☀️', text: 'Le village débat', cls: 'day' };
    else if (g.phase === 'vote') f = { icon: '🔥', text: 'L\'heure du vote', cls: 'vote' };
    if (!f) return undefined;
    setFlash(f);
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [g.phase]);

  // ----- Pré-jeu : composition des rôles -----
  if (g.phase === 'setup') {
    const cfg = g.config;
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title">Loup Garou — composition du village</h3>
        <p className="cn-hint-text">Choisis les cartes présentes dans la partie, puis lancez. Un maître du jeu (voix) anime les nuits. (4 à 18 joueurs)</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat"><Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} /><span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span></div>
          ))}
        </div>

        <div className="lg-config">
          <div className="lg-cfg-row">
            <span className="lg-cfg-label"><GiWerewolf size={20} /> Loups-Garous</span>
            <div className="lg-stepper">
              <IconButton size="small" disabled={!isHost || cfg.wolves <= 1} onClick={() => onAction({ kind: 'config', config: { wolves: cfg.wolves - 1 } })}><Minus size={16} /></IconButton>
              <b>{cfg.wolves}</b>
              <IconButton size="small" disabled={!isHost} onClick={() => onAction({ kind: 'config', config: { wolves: cfg.wolves + 1 } })}><Plus size={16} /></IconButton>
            </div>
          </div>
          <div className="lg-cfg-cards">
            {SPECIALS.map((key) => {
              const r = ROLE[key]; const on = !!cfg[key];
              return (
                <button key={key} className={`lg-pick-card ${r.cls} ${on ? 'on' : 'off'}`} disabled={!isHost}
                  onClick={() => onAction({ kind: 'config', config: { [key]: !on } })}>
                  <span className="lg-pick-art"><r.Icon /></span>
                  <span className="lg-pick-name">{r.label}</span>
                  <span className="lg-pick-state">{on ? 'dans la partie' : 'absent'}</span>
                </button>
              );
            })}
          </div>
          {!isHost && <p className="muted">Seul l'hôte règle la composition.</p>}
        </div>

        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la nuit</Button>}
        </div>
        {g.amSeated && g.seats.length < 4 && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 4 joueurs…</p>}
      </div>
    );
  }

  const mine = ROLE[g.myRole] || ROLE.villageois;
  const isNight = g.phase === 'night';
  const isDark = isNight || (g.phase === 'reveal' && g.resumeTo === 'night');

  // Votes publics du jour : on regroupe les votants par cible (aura + noms sur la cible).
  const votesByTarget = {};
  if (g.votes) for (const [voter, target] of Object.entries(g.votes)) (votesByTarget[target] ||= []).push(voter);
  // Cibles désignées par les loups (visible entre loups uniquement).
  const wolfByTarget = {};
  if (g.wolfPicks) for (const [w, target] of Object.entries(g.wolfPicks)) (wolfByTarget[target] ||= []).push(w);

  function clickPlayer(p) {
    if (!p.alive) return;
    if (poisonMode) { setWitchKill(p.id); setPoisonMode(false); return; }
    if (g.canCupid) { setCupidPicks((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length >= 2 ? s : [...s, p.id])); return; }
    if (g.canWild && p.id !== me) return onAction({ kind: 'wild', targetId: p.id });
    if (g.canGuard && p.id !== g.guardLast) return onAction({ kind: 'guard', targetId: p.id });
    if (g.canSee && p.id !== me) return onAction({ kind: 'see', targetId: p.id });
    if (g.canWolf && p.id !== me && !(g.fellowWolves || []).includes(p.id)) return onAction({ kind: 'wolf', targetId: p.id });
    if (g.canVote) { setVoteSel((s) => (s === p.id ? null : p.id)); return; } // sélection ; on valide ensuite
    if (g.canShoot) return onAction({ kind: 'shoot', targetId: p.id });
  }
  const selecting = g.canSee || g.canWolf || g.canVote || g.canShoot || poisonMode || g.canCupid || g.canWild || g.canGuard;

  function banner() {
    if (g.phase === 'over') {
      if (g.winner === 'loups') return '🐺 Les Loups-Garous gagnent';
      if (g.winner === 'amoureux') return '💘 Les amoureux gagnent';
      if (g.winner === 'ange') return '👼 L\'Ange gagne, seul';
      return '🌾 Le village gagne';
    }
    if (g.phase === 'hunter') return g.canShoot ? 'Chasseur : emporte quelqu\'un !' : 'Le Chasseur tire…';
    if (g.phase === 'reveal') return g.resumeTo === 'day' ? '🌅 Au petit matin…' : '⚖️ Le verdict du village';
    if (g.phase === 'vote') return g.voteLocked ? '🗳️ Dépouillement…' : g.canVote ? 'Vote : choisis puis valide' : 'Les votes tombent…';
    if (g.phase === 'day') return 'Le village débat…';
    if (isNight) return `Nuit ${g.nightNo}`;
    return '';
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  // La nuit, le MJ « fait sa ronde » autour de la table ; le jour, il reste au centre.
  const R = 58;
  const orbit = {
    x: [0, R * 0.71, R, R * 0.71, 0, -R * 0.71, -R, -R * 0.71, 0],
    y: [-R, -R * 0.71, 0, R * 0.71, R, R * 0.71, 0, -R * 0.71, -R],
  };

  return (
    <div className="lg fade-up">
      {/* Bandeau d'ambiance plein écran (bascule de phase) */}
      <AnimatePresence>
        {flash && (
          <motion.div key={flash.text} className={`lg-flash ${flash.cls}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            <motion.span className="lg-flash-icon"
              initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12 }}>{flash.icon}</motion.span>
            <span className="lg-flash-text">{flash.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ma carte de rôle (vraie carte illustrée) */}
      <div className={`lg-rolecard ${mine.cls} ${!g.alive ? 'dead' : ''}`}>
        <span className="lg-rolecard-tag">{g.alive ? 'Ton rôle' : 'Éliminé'}</span>
        <span className="lg-rolecard-art"><mine.Icon /></span>
        <span className="lg-rolecard-name">{mine.label}</span>
        <span className="lg-rolecard-desc">{mine.desc}</span>
        {g.fellowWolves && g.fellowWolves.length > 1 && <span className="lg-fellows">Complices : {g.fellowWolves.filter((w) => w !== me).map((w) => nameById[w]).join(', ')}</span>}
      </div>

      <div className={`lg-banner ${isDark ? 'night' : ''}`}>
        {banner()}
        {g.phase === 'day' && secsLeft != null && <span className="lg-timer"> · ⏳ {fmt(secsLeft)}</span>}
        {g.phase === 'vote' && secsLeft != null && <span className="lg-timer"> · ⏳ {secsLeft}s</span>}
      </div>

      {/* Pause commentée du MJ (matin / verdict) avec révélation des morts */}
      {g.phase === 'reveal' && (
        <motion.div className={`lg-reveal ${g.resumeTo === 'day' ? 'dawn' : 'dusk'}`}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="lg-reveal-say">« {g.say} »</p>
          {g.lastDeaths && g.lastDeaths.length > 0 ? (
            <div className="lg-reveal-dead">
              {g.lastDeaths.map((id, i) => {
                const r = ROLE[(g.players.find((p) => p.id === id) || {}).role] || null;
                return (
                  <motion.div key={id} className="lg-reveal-card"
                    initial={{ scale: 0.5, rotateY: 180, opacity: 0 }} animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.35, type: 'spring', stiffness: 160, damping: 14 }}>
                    <span className={`lg-reveal-art ${r ? r.cls : ''}`}>{r ? <r.Icon /> : <Skull />}</span>
                    <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={34} />
                    <span className="lg-reveal-name">{nameById[id] || '?'}</span>
                    {r && <span className="lg-reveal-role">{r.label}</span>}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="lg-reveal-safe">🌼 Personne n'est mort</div>
          )}
          {secsLeft != null && <span className="lg-reveal-count">{g.resumeTo === 'day' ? 'Le jour se lève' : 'La nuit revient'} dans {secsLeft}s…</span>}
        </motion.div>
      )}

      {/* Résultat voyante */}
      {g.seerResult && <div className="lg-info">🔮 {nameById[g.seerResult.targetId]} est <b>{ROLE[g.seerResult.role].label}</b></div>}

      {/* Amoureux / modèle de l'enfant sauvage */}
      {g.amLover && g.lovers && <div className="lg-info">💘 Tu es amoureux·se de <b>{nameById[g.lovers.find((l) => l !== me)] || '?'}</b></div>}
      {g.myRole === 'enfant' && g.wildModel && <div className="lg-info">👶 Ton modèle : <b>{nameById[g.wildModel]}</b></div>}

      {/* Cupidon : lier deux amoureux */}
      {g.canCupid && (
        <div className="cn-controls">
          <Button variant="contained" disabled={cupidPicks.length !== 2} onClick={() => onAction({ kind: 'cupid', a: cupidPicks[0], b: cupidPicks[1] })}>
            Lier les amoureux ({cupidPicks.length}/2)
          </Button>
        </div>
      )}

      {/* Sorcière */}
      {g.witch && (
        <div className="lg-witch">
          <p>{g.witch.victim ? <>Les loups attaquent <b>{nameById[g.witch.victim]}</b>.</> : 'Les loups n\'ont pas frappé.'}</p>
          <div className="cn-controls">
            {g.witch.healLeft && g.witch.victim && <Button size="small" variant="contained" color="success" onClick={() => onAction({ kind: 'witch', heal: true, killTarget: witchKill })}>Sauver {nameById[g.witch.victim]}</Button>}
            {g.witch.killLeft && <Button size="small" variant={poisonMode ? 'contained' : 'outlined'} color="error" onClick={() => setPoisonMode((p) => !p)}>{witchKill ? `Empoisonner ${nameById[witchKill]}` : 'Empoisonner…'}</Button>}
            <Button size="small" variant="outlined" onClick={() => onAction({ kind: 'witch', heal: false, killTarget: witchKill })}>Terminer</Button>
          </div>
        </div>
      )}

      {/* Table ronde : les joueurs en cercle autour du maître du jeu */}
      <div className={`lg-table ${isDark ? 'night' : 'day'}`}>
        {g.players.map((p, i) => {
          const n = g.players.length;
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 40;
          const y = 50 + Math.sin(ang) * 41;
          const dead = !p.alive;
          // Rôle connu de MOI : révélé par le serveur (mort, moi, complices loups, fin) ou vu par la voyante.
          const knownKey = p.role || seerKnown[p.id] || null;
          const known = knownKey ? ROLE[knownKey] : null;
          const voters = votesByTarget[p.id] || [];
          const wolfPickers = wolfByTarget[p.id] || [];
          const selected = voteSel === p.id || cupidPicks.includes(p.id);
          const aura = voters.length > 0 || wolfPickers.length > 0 || selected;
          return (
            <button key={p.id} className={`lg-player ${dead ? 'dead' : ''} ${selecting && p.alive ? 'pick' : ''} ${selected ? 'chosen' : ''} ${g.lovers && g.lovers.includes(p.id) ? 'lover' : ''} ${g.myVote === p.id ? 'myvote' : ''} ${voters.length ? 'targeted' : ''} ${wolfPickers.length ? 'wolf-target' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }} disabled={!selecting || dead} onClick={() => clickPlayer(p)}>
              {aura && <span className="lg-aura" aria-hidden />}
              <div className="lg-player-av"><Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={36} />{dead && <span className="lg-dead-x"><Skull size={15} /></span>}</div>
              <span className="lg-player-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              <div className={`lg-card3d ${known ? 'flipped' : ''}`}>
                <div className="lg-card3d-inner">
                  <div className="lg-card3d-back"><GiMoon /></div>
                  <div className={`lg-card3d-face ${known ? known.cls : ''}`}>{known && <known.Icon />}</div>
                </div>
              </div>
              {known && <span className="lg-card3d-label">{known.label}</span>}
              {/* Qui a voté contre cette personne (vote public du jour) */}
              {voters.length > 0 && (
                <span className="lg-votes" title={voters.map((v) => nameById[v]).join(', ')}>
                  <b>{voters.length}</b> {voters.map((v) => nameById[v] || '?').join(', ')}
                </span>
              )}
              {wolfPickers.length > 0 && <span className="lg-wolfmark"><GiWerewolf /> visée</span>}
            </button>
          );
        })}
        {/* Maître du jeu : la nuit il fait sa ronde, le jour il trône au centre */}
        <div className="lg-mj-wrap">
          <motion.div className={`lg-mj ${isNight ? 'roaming' : ''}`}
            animate={isNight ? orbit : { x: 0, y: 0 }}
            transition={isNight
              ? { duration: 18, repeat: Infinity, ease: 'linear' }
              : { type: 'spring', stiffness: 120, damping: 18 }}>
            <span className="lg-mj-emo"><GiWizardFace /></span>
            <span className="lg-mj-say">{g.say}</span>
            <IconButton size="small" className="lg-mj-voice" onClick={() => { setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }} title="Voix du maître du jeu">
              {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconButton>
          </motion.div>
        </div>
      </div>

      {/* Contrôles bas */}
      {g.phase === 'day' && (
        <div className="cn-controls" style={{ flexDirection: 'column', gap: 6 }}>
          <p className="muted" style={{ margin: 0 }}>Débattez… le vote démarrera tout seul à la fin des 2 minutes.</p>
          {isHost && (
            <Button size="small" variant="contained" startIcon={<Vote size={16} />}
              onClick={() => onAction({ kind: 'callVote' })}>
              Passer au vote maintenant
            </Button>
          )}
        </div>
      )}
      {(g.canSee || g.canWolf || g.canShoot) && <p className="muted" style={{ textAlign: 'center' }}>Choisis une personne ci-dessus.</p>}
      {g.phase === 'vote' && g.canVote && (
        <div className="cn-controls">
          <Button variant="contained" disabled={!voteSel}
            onClick={() => { onAction({ kind: 'vote', targetId: voteSel }); setVoteSel(null); }}>
            {voteSel ? `Valider mon vote : ${nameById[voteSel]}` : 'Choisis qui accuser ci-dessus…'}
          </Button>
        </div>
      )}
      {g.phase === 'vote' && !g.canVote && !g.voteLocked && g.alive && <p className="muted" style={{ textAlign: 'center' }}>Ton vote est validé — on attend les autres…</p>}
      {g.phase === 'vote' && g.voteLocked && <p className="muted" style={{ textAlign: 'center' }}>🗳️ Dépouillement… {secsLeft != null ? `${secsLeft}s` : ''}</p>}
      {isNight && !g.canSee && !g.canWolf && !g.witch && !g.canCupid && !g.canWild && !g.canGuard && g.alive && <p className="muted" style={{ textAlign: 'center' }}>Tu dors… 😴 (les rôles de la nuit agissent)</p>}
      {!g.alive && g.phase !== 'over' && <p className="muted" style={{ textAlign: 'center' }}>Tu es éliminé — tu observes la partie.</p>}

      {g.phase === 'over' && isHost && <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>}
    </div>
  );
}

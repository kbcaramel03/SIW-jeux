import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Switch, FormControlLabel } from '@mui/material';
import { Play, Sparkles, Minus, Plus, Volume2, VolumeX, Skull } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { speak, stopSpeak, voiceSupported } from '../voice.js';
import { winConfetti } from '../effects.js';

// Cartes de rôles (design maison : emblème + couleur + description).
const ROLE = {
  loup: { label: 'Loup-Garou', emo: '🐺', cls: 'loup', desc: 'Chaque nuit, dévore un villageois avec les autres loups. Gagne si les loups dominent.' },
  villageois: { label: 'Villageois', emo: '🧑‍🌾', cls: 'villageois', desc: 'Aucun pouvoir, juste ta ruse. Démasque les loups au vote du jour.' },
  voyante: { label: 'Voyante', emo: '🔮', cls: 'voyante', desc: 'Chaque nuit, découvre le rôle d\'une personne de ton choix.' },
  sorciere: { label: 'Sorcière', emo: '🧪', cls: 'sorciere', desc: 'Une potion de vie (sauver la victime), une potion de mort (éliminer quelqu\'un).' },
  chasseur: { label: 'Chasseur', emo: '🏹', cls: 'chasseur', desc: 'En mourant, tu emportes une personne avec toi.' },
};
const SPECIALS = [['voyante', 'Voyante'], ['sorciere', 'Sorcière'], ['chasseur', 'Chasseur']];

export default function LoupGarou({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const nameById = Object.fromEntries(room.players.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(room.players.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(room.players.map((p) => [p.id, p.avatar]));
  const [voiceOn, setVoiceOn] = useState(true);
  const [poisonMode, setPoisonMode] = useState(false);
  const [witchKill, setWitchKill] = useState(null);
  const lastSay = useRef(-1);

  useEffect(() => { if (g.phase === 'setup' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);

  // Narration : seul l'hôte parle (évite la cacophonie), à chaque nouvelle phrase.
  useEffect(() => {
    if (!isHost || !voiceOn) return;
    if (g.sayId != null && g.sayId !== lastSay.current) { lastSay.current = g.sayId; speak(g.say); }
  }, [g.sayId, voiceOn, isHost]);
  useEffect(() => () => stopSpeak(), []);
  useEffect(() => {
    if (g.phase === 'over' && ((g.winner === 'loups' && g.myRole === 'loup') || (g.winner === 'village' && g.myRole !== 'loup'))) winConfetti();
  }, [g.phase]);
  useEffect(() => { setPoisonMode(false); setWitchKill(null); }, [g.nightStep, g.phase]);

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
            <span className="lg-cfg-label">🐺 Loups-Garous</span>
            <div className="lg-stepper">
              <IconButton size="small" disabled={!isHost || cfg.wolves <= 1} onClick={() => onAction({ kind: 'config', config: { wolves: cfg.wolves - 1 } })}><Minus size={16} /></IconButton>
              <b>{cfg.wolves}</b>
              <IconButton size="small" disabled={!isHost} onClick={() => onAction({ kind: 'config', config: { wolves: cfg.wolves + 1 } })}><Plus size={16} /></IconButton>
            </div>
          </div>
          {SPECIALS.map(([key, label]) => (
            <FormControlLabel key={key} control={<Switch checked={!!cfg[key]} disabled={!isHost} onChange={(e) => onAction({ kind: 'config', config: { [key]: e.target.checked } })} />}
              label={<span>{ROLE[key].emo} {label}</span>} />
          ))}
          {!isHost && <p className="muted">Seul l'hôte règle la composition.</p>}
        </div>

        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre</Button>}
          {g.canStart && isHost && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la nuit</Button>}
        </div>
        {g.amSeated && g.seats.length < 4 && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 4 joueurs…</p>}
      </div>
    );
  }

  const mine = ROLE[g.myRole] || ROLE.villageois;
  const isNight = g.phase === 'night';

  function clickPlayer(p) {
    if (!p.alive) return;
    if (poisonMode) { setWitchKill(p.id); setPoisonMode(false); return; }
    if (g.canSee && p.id !== me) return onAction({ kind: 'see', targetId: p.id });
    if (g.canWolf && p.id !== me && !(g.fellowWolves || []).includes(p.id)) return onAction({ kind: 'wolf', targetId: p.id });
    if (g.canVote) return onAction({ kind: 'vote', targetId: p.id });
    if (g.canShoot) return onAction({ kind: 'shoot', targetId: p.id });
  }
  const selecting = g.canSee || g.canWolf || g.canVote || g.canShoot || poisonMode;

  function banner() {
    if (g.phase === 'over') return g.winner === 'loups' ? '🐺 Les Loups-Garous gagnent' : '🌾 Le village gagne';
    if (g.phase === 'hunter') return g.canShoot ? 'Chasseur : emporte quelqu\'un !' : 'Le Chasseur tire…';
    if (g.phase === 'vote') return g.canVote ? 'Vote : qui pend-on ?' : `Vote en cours…`;
    if (g.phase === 'day') return 'Le village débat…';
    if (isNight) return `Nuit ${g.nightNo}`;
    return '';
  }

  return (
    <div className="lg fade-up">
      {/* Ma carte de rôle */}
      <div className={`lg-myrole ${mine.cls} ${!g.alive ? 'dead' : ''}`}>
        <span className="lg-myrole-emo">{mine.emo}</span>
        <div>
          <div className="lg-myrole-label">{g.alive ? `Tu es ${mine.label}` : `Tu étais ${mine.label} — éliminé`}</div>
          <div className="lg-myrole-desc">{mine.desc}</div>
          {g.fellowWolves && g.fellowWolves.length > 1 && <div className="lg-fellows">Tes complices : {g.fellowWolves.filter((w) => w !== me).map((w) => nameById[w]).join(', ')}</div>}
        </div>
      </div>

      <div className={`lg-banner ${isNight ? 'night' : ''}`}>{banner()}</div>

      {/* Résultat voyante */}
      {g.seerResult && <div className="lg-info">🔮 {nameById[g.seerResult.targetId]} est <b>{ROLE[g.seerResult.role].label}</b></div>}

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
      <div className={`lg-table ${isNight ? 'night' : 'day'}`}>
        {g.players.map((p, i) => {
          const n = g.players.length;
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + Math.cos(ang) * 40;
          const y = 50 + Math.sin(ang) * 41;
          const dead = !p.alive;
          const role = p.role ? ROLE[p.role] : null;
          return (
            <button key={p.id} className={`lg-player ${dead ? 'dead' : ''} ${selecting && p.alive ? 'pick' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }} disabled={!selecting || dead} onClick={() => clickPlayer(p)}>
              <div className="lg-player-av"><Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={38} />{dead && <span className="lg-dead-x"><Skull size={15} /></span>}</div>
              <span className="lg-player-name">{nameById[p.id] || '?'}{p.id === me ? ' (toi)' : ''}</span>
              {role && <span className={`lg-role-tag ${role.cls}`}>{role.emo}</span>}
            </button>
          );
        })}
        {/* Maître du jeu au centre */}
        <div className="lg-mj">
          <span className="lg-mj-emo">🧙</span>
          <span className="lg-mj-say">{g.say}</span>
          {voiceSupported() && (
            <IconButton size="small" className="lg-mj-voice" onClick={() => { setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }} title="Voix du maître du jeu">
              {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </IconButton>
          )}
        </div>
      </div>

      {/* Contrôles bas */}
      {g.phase === 'day' && isHost && <div className="cn-controls"><Button variant="contained" onClick={() => onAction({ kind: 'callVote' })}>Passer au vote</Button></div>}
      {g.phase === 'day' && !isHost && <p className="muted" style={{ textAlign: 'center' }}>Débattez… l'hôte lancera le vote.</p>}
      {(g.canSee || g.canWolf || g.canVote || g.canShoot) && <p className="muted" style={{ textAlign: 'center' }}>Choisis une personne ci-dessus.</p>}
      {isNight && !g.canSee && !g.canWolf && !g.witch && g.alive && <p className="muted" style={{ textAlign: 'center' }}>Tu dors… 😴 (les rôles de la nuit agissent)</p>}
      {!g.alive && g.phase !== 'over' && <p className="muted" style={{ textAlign: 'center' }}>Tu es éliminé — tu observes la partie.</p>}

      {g.phase === 'over' && isHost && <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>}
    </div>
  );
}

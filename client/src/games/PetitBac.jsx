import { useEffect, useRef, useState } from 'react';
import { Button, TextField, Chip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Play, Sparkles, PenLine, Send, Check, X } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

export default function PetitBac({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));

  const [answers, setAnswers] = useState({});
  const [now, setNow] = useState(Date.now());
  const sentRef = useRef(false);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); } }, [g.phase]);

  // Nouvelle manche : on repart avec des champs vides.
  useEffect(() => {
    if (g.phase === 'write') { setAnswers({}); sentRef.current = g.mySubmitted; }
  }, [g.letter, g.round]);

  // Compte à rebours.
  useEffect(() => {
    if (!g.deadline) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [g.deadline]);
  const left = g.deadline ? Math.max(0, Math.round((g.deadline - now) / 1000)) : null;

  function send() {
    if (sentRef.current || g.mySubmitted) return;
    sentRef.current = true;
    popSound();
    onAction({ kind: 'submit', answers });
  }
  // Le temps est écoulé : on envoie ce qu'on a (le serveur laisse 2 s de marge).
  useEffect(() => {
    if (g.phase === 'write' && g.amSeated && !g.mySubmitted && left === 0) send();
  }, [left, g.phase]);

  function toggleCategory(cat) {
    const has = g.categories.includes(cat);
    const next = has ? g.categories.filter((c) => c !== cat) : [...g.categories, cat];
    if (next.length < 3 || next.length > 10) return;
    onAction({ kind: 'config', categories: next });
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><PenLine size={20} color="#7a3fbf" /> Petit Bac — salle d'attente</h3>
        <p className="cn-hint-text">Le jeu du baccalauréat ! Une lettre est tirée : remplissez chaque catégorie par un mot qui commence par cette lettre, avant la fin du chrono. Ensuite, tout le monde relit et vote ✓ ou ✗ sur chaque mot des autres — plus de ✗ que de ✓ et le mot est refusé. Réponse unique = 10 points, doublon = 5, vide ou refusée = 0. Le plus grand total gagne. De 2 à 10 joueuses.</p>

        <div className="pb-config">
          <div className="pb-config-row">
            <span className="pb-config-label">Manches :</span>
            {isHost ? (
              <ToggleButtonGroup value={g.rounds} exclusive color="primary" size="small"
                onChange={(_, v) => v && onAction({ kind: 'config', rounds: v })}>
                {[2, 3, 5, 7, 10].map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
              </ToggleButtonGroup>
            ) : <b>{g.rounds}</b>}
          </div>
          <div className="pb-config-row">
            <span className="pb-config-label">Catégories ({g.categories.length}) {isHost ? '— touche pour choisir (3 à 10) :' : ':'}</span>
          </div>
          <div className="pb-cats">
            {(isHost ? (g.allCategories || []) : g.categories).map((cat) => (
              <Chip key={cat} label={cat} size="small"
                color={g.categories.includes(cat) ? 'primary' : 'default'}
                variant={g.categories.includes(cat) ? 'filled' : 'outlined'}
                onClick={isHost ? () => toggleCategory(cat) : undefined} />
            ))}
          </div>
          {!isHost && <p className="muted" style={{ margin: '4px 0 0' }}>L'hôte règle les manches et les catégories.</p>}
        </div>

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
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const banner = g.phase === 'over'
    ? (g.winners?.length > 1
      ? (g.winners.includes(me) ? 'Égalité — tu partages la victoire !' : `Égalité entre ${g.winners.map((id) => nameById[id] || '?').join(' et ')} !`)
      : (g.winners?.[0] === me ? 'Tu gagnes la partie !' : `${nameById[g.winners?.[0]] || '?'} gagne la partie !`))
    : g.phase === 'write'
      ? (g.mySubmitted ? 'Copie rendue — en attente des autres…' : `Un mot en ${g.letter} par catégorie !`)
      : g.aiStatus === 'pending' ? 'Relecture — l\'IA corrige… vos votes ✓/✗ gardent le dernier mot.'
        : g.aiStatus === 'done' ? 'L\'IA a pré-corrigé (🤖) — votez ✓/✗ pour la contredire.'
          : 'Relecture : ✓ pour valider, ✗ pour refuser chaque mot.';

  const scoreboard = (
    <div className="pool-players">
      {g.seats.map((id) => (
        <div key={id} className={`pool-chip ${g.phase === 'write' && g.submitted[id] ? 'active' : ''}`}>
          <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
          <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
          <b>{g.scores[id] || 0} pts</b>
          {g.phase === 'write' && g.submitted[id] && <Check size={15} color="#2e8f5b" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="pb fade-up">
      <div className={`gf-banner ${g.phase === 'write' && !g.mySubmitted ? 'mine' : ''}`}>{banner}</div>
      {scoreboard}

      <div className="pb-round">
        <span className="pb-letter">{g.letter}</span>
        <span>Manche {g.round}/{g.rounds}</span>
        {left != null && g.phase !== 'over' && <span className="pb-timer">⏱ {left}s</span>}
      </div>

      {g.phase === 'write' && (
        <div className="pb-form">
          {g.categories.map((cat) => (
            <TextField key={cat} size="small" fullWidth label={cat}
              value={answers[cat] || ''}
              disabled={g.mySubmitted || !g.amSeated}
              onChange={(e) => setAnswers((a) => ({ ...a, [cat]: e.target.value }))}
              placeholder={`${cat} en ${g.letter}…`}
              slotProps={{ htmlInput: { maxLength: 40, autoComplete: 'off', autoCorrect: 'off' } }} />
          ))}
          {!g.mySubmitted && g.amSeated && (
            <Button variant="contained" startIcon={<Send size={18} />} onClick={send}>J'ai fini !</Button>
          )}
        </div>
      )}

      {g.phase === 'review' && g.results && (
        <div className="pb-review">
          {g.categories.map((cat) => (
            <div key={cat} className="pb-cat">
              <div className="pb-cat-title">{cat}</div>
              {g.seats.map((id) => {
                const r = g.results[id][cat];
                const mine = id === me;
                const votable = !mine && !!r.text;
                return (
                  <div key={id} className={`pb-answer ${r.pts === 10 ? 'ok' : r.pts === 5 ? 'dup' : 'zero'}`}>
                    <span className="pb-answer-name">{nameById[id] || '?'}</span>
                    <span className="pb-answer-text">{r.text || '—'}</span>
                    {(r.plus > 0 || r.minus > 0 || !!r.ai) && (
                      <span className="pb-answer-tally">
                        {r.ai === 1 && <em className="yes">🤖✓</em>}
                        {r.ai === -1 && <em className="no">🤖✗</em>}
                        {r.plus > 0 && <em className="yes">✓{r.plus}</em>}
                        {r.minus > 0 && <em className="no">✗{r.minus}</em>}
                      </span>
                    )}
                    {votable && (
                      <span className="pb-vote">
                        <button type="button" className={`pb-vote-btn yes ${r.myVote === 1 ? 'on' : ''}`}
                          onClick={() => onAction({ kind: 'vote', targetId: id, cat, value: 1 })} aria-label="Valider">
                          <Check size={15} />
                        </button>
                        <button type="button" className={`pb-vote-btn no ${r.myVote === -1 ? 'on' : ''}`}
                          onClick={() => onAction({ kind: 'vote', targetId: id, cat, value: -1 })} aria-label="Refuser">
                          <X size={15} />
                        </button>
                      </span>
                    )}
                    <b>+{r.pts}</b>
                  </div>
                );
              })}
            </div>
          ))}
          {g.isHost && (
            <Button variant="contained" startIcon={<Check size={18} />} onClick={() => onAction({ kind: 'next' })}>
              {g.round >= g.rounds ? 'Valider — résultats !' : 'Valider — manche suivante'}
            </Button>
          )}
        </div>
      )}

      {g.phase === 'over' && (
        <div className="pb-review">
          {[...g.seats].sort((a, b) => (g.scores[b] || 0) - (g.scores[a] || 0)).map((id, i) => (
            <div key={id} className={`pb-rank ${g.winners?.includes(id) ? 'winner' : ''}`}>
              <span className="pb-rank-pos">{i + 1}</span>
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={28} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
              <b>{g.scores[id] || 0} pts</b>
            </div>
          ))}
          {isHost && (
            <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
          )}
        </div>
      )}
    </div>
  );
}

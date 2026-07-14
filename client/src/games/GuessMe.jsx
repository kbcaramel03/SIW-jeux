import { useEffect, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Eye, CheckCircle2, Trophy } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound } from '../effects.js';

export default function GuessMe({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const [guesses, setGuesses] = useState(g.myGuesses || {});
  const [myPick, setMyPick] = useState(null); // choix local, modifiable avant l'envoi

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => { setGuesses(g.myGuesses || {}); setMyPick(null); }, [g.phase, g.round]);
  useEffect(() => { if (g.phase === 'reveal') popSound(); }, [g.phase, g.round]);
  useEffect(() => { if (g.phase === 'over' && g.winner === me) winConfetti(); }, [g.phase]);

  const q = g.question || { a: 'A', b: 'B' };
  const myPlayer = g.players.find((p) => p.id === me);
  const sorted = useMemo(() => [...g.players].sort((a, b) => b.score - a.score), [g.players]);
  const completeGuesses = g.seats.filter((id) => id !== me).every((id) => guesses[id] === 'a' || guesses[id] === 'b');

  function choiceText(v) {
    return v === 'a' ? q.a : q.b;
  }

  function pickGuess(targetId, choice) {
    setGuesses((prev) => ({ ...prev, [targetId]: choice }));
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card gm-wait">
        <h3 className="section-title"><span className="gm-logo-mark">??</span> GuessMe - salle d'attente</h3>
        <p className="cn-hint-text">Choisis ta reponse en secret, puis devine ce que les autres ont choisi. Chaque bonne devinette donne 1 point.</p>
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
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Demarrer la partie</Button>}
        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'au moins 2 joueuses...</p>}
      </div>
    );
  }

  return (
    <div className="gm fade-up">
      <div className="gm-top">
        <div>
          <span className="gm-kicker">Manche {Math.min(g.round, g.totalRounds)} / {g.totalRounds}</span>
          <h3>{q.q || <>{q.a} <span>ou</span> {q.b}</>}</h3>
        </div>
        <div className="gm-scorechip"><Trophy size={16} /> {myPlayer?.score || 0} pts</div>
      </div>

      {g.phase === 'answer' && (
        <div className="gm-panel">
          <div className="gm-status">{g.myAnswer ? <><CheckCircle2 size={18} /> Reponse envoyee</> : 'Choisis ta reponse secrete'}</div>
          <div className="gm-choice-row">
            <button className={`gm-choice ${(g.myAnswer || myPick) === 'a' ? 'on' : ''}`} disabled={!!g.myAnswer} onClick={() => setMyPick('a')}>{q.a}</button>
            <button className={`gm-choice ${(g.myAnswer || myPick) === 'b' ? 'on' : ''}`} disabled={!!g.myAnswer} onClick={() => setMyPick('b')}>{q.b}</button>
          </div>
          {!g.myAnswer && (
            <div className="cn-controls">
              <Button variant="contained" disabled={!myPick} onClick={() => onAction({ kind: 'answer', choice: myPick })}>
                Valider ma reponse
              </Button>
            </div>
          )}
          <p className="muted">{g.answeredCount}/{g.seats.length} reponses recues</p>
        </div>
      )}

      {g.phase === 'guess' && (
        <div className="gm-panel">
          <div className="gm-status"><Eye size={18} /> Devine les reponses des autres</div>
          <div className="gm-guess-list">
            {g.players.filter((p) => p.id !== me).map((p) => (
              <div key={p.id} className="gm-guess-row">
                <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} />
                <b>{nameById[p.id] || '?'}</b>
                <div className="gm-mini-choices">
                  <button className={guesses[p.id] === 'a' ? 'on' : ''} onClick={() => pickGuess(p.id, 'a')}>{q.a}</button>
                  <button className={guesses[p.id] === 'b' ? 'on' : ''} onClick={() => pickGuess(p.id, 'b')}>{q.b}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cn-controls">
            <Button variant="contained" disabled={!completeGuesses || g.iGuessed} onClick={() => onAction({ kind: 'guess', guesses })}>
              {g.iGuessed ? 'Pronostics envoyes' : 'Valider mes pronostics'}
            </Button>
          </div>
          <p className="muted">{g.guessedCount}/{g.seats.length} pronostics valides</p>
        </div>
      )}

      {(g.phase === 'reveal' || g.phase === 'over') && (
        <div className="gm-reveal">
          {g.players.map((p) => (
            <div key={p.id} className="gm-reveal-card">
              <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={30} />
              <div className="gm-reveal-info">
                <b>{nameById[p.id] || '?'}</b>
                <span className="gm-answer">{p.answer ? choiceText(p.answer) : '?'}</span>
              </div>
              {p.gain != null && <span className="gm-gain">+{p.gain}</span>}
            </div>
          ))}
          {g.phase === 'reveal' && <Button variant="outlined" onClick={() => onAction({ kind: 'next' })}>Manche suivante</Button>}
        </div>
      )}

      <div className="gm-ranking">
        {sorted.map((p, i) => (
          <div key={p.id} className={`gm-rank ${p.id === g.winner ? 'win' : ''}`}>
            <span>{i + 1}</span>
            <Avatar name={nameById[p.id]} gender={genderById[p.id]} avatar={avatarById[p.id]} size={24} />
            <b>{nameById[p.id] || '?'}</b>
            <strong>{p.score}</strong>
          </div>
        ))}
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

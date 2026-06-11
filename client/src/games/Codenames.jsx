import { useState } from 'react';
import { Eye, Crown, Users, Check, SkipForward, Sparkles, ShieldCheck, Timer, UserSearch, LogIn, Handshake } from 'lucide-react';

// Affiche le jeu Code Names. Reçoit la vue personnalisée du serveur.
export default function Codenames({ room, isHost, onAction, onNewGame }) {
  const game = room.game;
  const me = room.me.id;
  const nameById = Object.fromEntries((room.roster || room.players).map((p) => [p.id, p.displayName]));

  if (!game) {
    return (
      <div className="cn-empty card">
        <h3 className="section-title"><UserSearch size={20} /> Code Names</h3>
        <p className="muted">Aucune partie en cours.</p>
        {isHost ? (
          <button className="btn btn-primary" onClick={onNewGame}><Sparkles size={18} /> Lancer une partie</button>
        ) : (
          <p className="muted">En attente que l'hôte lance la partie…</p>
        )}
      </div>
    );
  }

  if (game.phase === 'setup') {
    return game.mode === 'duet'
      ? <DuetSetup game={game} me={me} isHost={isHost} nameById={nameById} onAction={onAction} />
      : <VersusSetup game={game} me={me} isHost={isHost} nameById={nameById} onAction={onAction} />;
  }

  return (
    <div className="cn fade-up">
      <TopBar game={game} me={me} nameById={nameById} />
      <Board game={game} me={me} nameById={nameById} onAction={onAction} />
      <Controls game={game} me={me} onAction={onAction} />
      {game.phase === 'over' && <Over game={game} isHost={isHost} onNewGame={onNewGame} />}
      <div className="cn-log">
        {game.log.map((line, i) => <div key={i} className="cn-log-line">{line}</div>)}
      </div>
    </div>
  );
}

function sideMembers(team) {
  return [team.spymaster, ...team.operatives].filter(Boolean);
}

/* ---------- SETUP VERSUS (4+) ---------- */
function VersusTeam({ side, game, nameById, onAction }) {
  const t = game.teams[side];
  const label = side === 'red' ? 'Rose' : 'Bleue';
  return (
    <div className={`cn-team cn-team-${side}`}>
      <h4>Équipe {label}</h4>
      <div className="cn-role">
        <Crown size={16} /> <span>Maître-espion :</span>
        <strong>{t.spymaster ? nameById[t.spymaster] || '—' : '(personne)'}</strong>
        <button className="btn btn-secondary btn-mini" onClick={() => onAction({ kind: 'assign', team: side, role: 'spymaster' })}>Prendre</button>
      </div>
      <div className="cn-role">
        <Users size={16} /> <span>Agents :</span>
        <strong>{t.operatives.map((id) => nameById[id] || '?').join(', ') || '(personne)'}</strong>
        <button className="btn btn-secondary btn-mini" onClick={() => onAction({ kind: 'assign', team: side, role: 'operative' })}>Rejoindre</button>
      </div>
    </div>
  );
}

function VersusSetup({ game, isHost, nameById, onAction }) {
  const canPlay = (t) => !!game.teams[t].spymaster && game.teams[t].operatives.length > 0;
  const ready = canPlay('red') && canPlay('blue');
  return (
    <div className="cn-setup card">
      <h3 className="section-title"><UserSearch size={20} /> Code Names · Versus</h3>
      <p className="cn-hint-text">
        Deux équipes s'affrontent. Dans chaque équipe : <strong>un maître-espion</strong> (il voit les couleurs et donne les indices)
        et <strong>au moins un agent</strong> (il devine). Première équipe à trouver tous ses mots gagne.
      </p>
      <div className="cn-teams">
        <VersusTeam side="red" game={game} nameById={nameById} onAction={onAction} />
        <VersusTeam side="blue" game={game} nameById={nameById} onAction={onAction} />
      </div>
      {isHost ? (
        <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => onAction({ kind: 'start' })}>
          {ready ? 'Démarrer la partie' : 'Chaque équipe a besoin d\'un maître-espion + un agent'}
        </button>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>En attente que l'hôte démarre…</p>
      )}
    </div>
  );
}

/* ---------- SETUP DUO (2-3) ---------- */
function DuetSide({ side, game, me, nameById, onAction }) {
  const members = sideMembers(game.teams[side]);
  const mine = members.includes(me);
  const label = side === 'red' ? 'Rose' : 'Bleu';
  return (
    <div className={`cn-team cn-team-${side}`}>
      <h4>Côté {label}</h4>
      <ul className="duet-members">
        {members.length === 0
          ? <li className="muted">Personne pour l'instant</li>
          : members.map((id) => <li key={id}>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</li>)}
      </ul>
      <button
        className={`btn btn-mini ${mine ? 'btn-ghost' : 'btn-secondary'}`}
        disabled={mine}
        onClick={() => onAction({ kind: 'assign', team: side, role: 'operative' })}
      >
        <LogIn size={15} /> {mine ? 'Tu es ici' : 'Rejoindre ce côté'}
      </button>
    </div>
  );
}

function DuetSetup({ game, me, isHost, nameById, onAction }) {
  const manned = (t) => sideMembers(game.teams[t]).length > 0;
  const ready = manned('red') && manned('blue');
  return (
    <div className="cn-setup card">
      <h3 className="section-title"><Handshake size={20} /> Code Names · Duo coopératif</h3>
      <p className="cn-hint-text">
        Vous jouez <strong>ensemble contre le jeu</strong>. Chacun rejoint un côté : à tour de rôle, un côté <strong>fait deviner</strong>
        ses mots à l'autre. Objectif commun : trouver les <strong>15 agents</strong> en <strong>9 tours</strong>, sans tomber sur un assassin.
      </p>
      <div className="cn-teams">
        <DuetSide side="red" game={game} me={me} nameById={nameById} onAction={onAction} />
        <DuetSide side="blue" game={game} me={me} nameById={nameById} onAction={onAction} />
      </div>
      {isHost ? (
        <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => onAction({ kind: 'start' })}>
          {ready ? 'Démarrer le Duo' : 'Il faut au moins une personne de chaque côté'}
        </button>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>En attente que l'hôte démarre…</p>
      )}
    </div>
  );
}

/* ---------- BARRE DU HAUT ---------- */
function TopBar({ game, me, nameById }) {
  const cluePill = game.clue && (
    <span className="cn-clue-pill">
      « {game.clue.word} » — {game.clue.count}
      {game.guessesLeft > 0 && <span className="muted">· {game.guessesLeft} essai(s)</span>}
    </span>
  );

  if (game.mode === 'duet') {
    const activeNames = sideMembers(game.teams[game.turn]).map((id) => nameById[id] || '?').join(', ');
    let line;
    if (game.phase !== 'playing') line = null;
    else if (game.isClueGiver) line = <strong>À toi de faire deviner — donne un indice !</strong>;
    else if (game.isGuesser) line = <><strong>{activeNames}</strong> te fait deviner — à toi de trouver !</>;
    else line = <><strong>{activeNames}</strong> fait deviner…</>;
    return (
      <div className="cn-topbar cn-topbar-duet">
        <div className="duet-stats">
          <span className="duet-chip agents"><ShieldCheck size={16} /> {game.agentsFound}/{game.agentsTotal} agents</span>
          <span className="duet-chip turns"><Timer size={16} /> {game.turnsLeft} tours</span>
        </div>
        <div className="cn-turn">
          {line}
          <div>{cluePill}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="cn-topbar">
      <span className="cn-count cn-count-red">{game.counts.red}</span>
      <div className="cn-turn">
        {game.phase === 'playing' && <>Au tour de l'équipe {game.turn === 'red' ? 'rose' : 'bleue'}</>}
        <div>{cluePill}</div>
      </div>
      <span className="cn-count cn-count-blue">{game.counts.blue}</span>
    </div>
  );
}

/* ---------- PLATEAU ---------- */
function Board({ game, me, nameById, onAction }) {
  const canGuess = game.phase === 'playing' && game.clue && game.isGuesser;
  const mySelection = game.selections?.[me];

  const pickers = {};
  for (const [uid, idx] of Object.entries(game.selections || {})) {
    (pickers[idx] ||= []).push(nameById[uid] || '?');
  }

  return (
    <div className="cn-board">
      {game.board.map((card, i) => {
        const cls = ['cn-card'];
        if (card.revealed) cls.push('revealed', `c-${card.color}`);
        else {
          if (card.color) cls.push(`hint-${card.color}`); // versus : vue maître-espion
          if (card.hint) cls.push(`hint-${card.hint}`);    // duo : ma clé
        }
        if (mySelection === i) cls.push('selected-me');
        if (canGuess && !card.revealed) cls.push('clickable');
        return (
          <button
            key={i}
            className={cls.join(' ')}
            disabled={!canGuess || card.revealed}
            onClick={() => onAction({ kind: 'select', index: i })}
          >
            {card.word}
            {pickers[i] && (
              <span className="cn-pickers">
                {pickers[i].map((n, k) => <span key={k} className="cn-picker-tag">{n}</span>)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- COMMANDES ---------- */
function Controls({ game, me, onAction }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  if (game.phase !== 'playing') return null;

  if (game.isClueGiver && !game.clue) {
    return (
      <form
        className="cn-controls"
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          onAction({ kind: 'clue', word: word.trim(), count });
          setWord('');
          setCount(1);
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Ton indice (un seul mot)" style={{ maxWidth: 240 }} />
        <input type="number" min="0" max="9" value={count} onChange={(e) => setCount(+e.target.value)} className="cn-count-input input" />
        <button className="btn btn-primary"><Eye size={17} /> Donner l'indice</button>
      </form>
    );
  }

  if (game.isGuesser && game.clue) {
    const hasSelection = game.selections?.[me] !== undefined;
    return (
      <div className="cn-controls">
        <span className="muted">Sélectionne une carte, puis valide :</span>
        <button className="btn btn-primary" disabled={!hasSelection} onClick={() => onAction({ kind: 'confirm' })}>
          <Check size={17} /> Valider ma carte
        </button>
        <button className="btn btn-ghost" onClick={() => onAction({ kind: 'pass' })}><SkipForward size={16} /> Passer</button>
      </div>
    );
  }

  return <p className="muted cn-wait">En attente de l'autre équipe…</p>;
}

/* ---------- FIN ---------- */
function Over({ game, isHost, onNewGame }) {
  let title;
  if (game.mode === 'duet') {
    title = game.result === 'won' ? 'Gagné ! Les 15 agents sont trouvés !' : 'Perdu… ce sera mieux la prochaine fois !';
  } else {
    title = game.winner === 'red' ? "L'équipe rose gagne !" : "L'équipe bleue gagne !";
  }
  return (
    <div className="cn-over">
      <h3>{title}</h3>
      {isHost && <button className="btn btn-primary" onClick={onNewGame}><Sparkles size={18} /> Rejouer</button>}
    </div>
  );
}

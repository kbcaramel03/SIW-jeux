import { useState } from 'react';

// Affiche le jeu Code Names. Reçoit la vue personnalisée du serveur
// (les agents ne voient pas les couleurs, le·la maître-espion oui).
export default function Codenames({ room, isHost, onAction, onNewGame }) {
  const game = room.game;
  const me = room.me.id;
  const nameById = Object.fromEntries(room.players.map((p) => [p.id, p.displayName]));

  if (!game) {
    return (
      <div className="cn-empty card">
        <h3>🕵️ Code Names</h3>
        <p className="muted">Aucune partie en cours.</p>
        {isHost ? (
          <button className="btn btn-primary" onClick={onNewGame}>Lancer une partie</button>
        ) : (
          <p className="muted">En attente que l'hôte lance la partie…</p>
        )}
      </div>
    );
  }

  if (game.phase === 'setup') {
    return <Setup game={game} me={me} isHost={isHost} nameById={nameById} onAction={onAction} />;
  }

  return (
    <div className="cn">
      <Scoreboard game={game} nameById={nameById} />
      <Board game={game} me={me} onAction={onAction} />
      <Controls game={game} me={me} onAction={onAction} />
      {game.phase === 'over' && (
        <div className="cn-over">
          <h3>
            {game.winner === null
              ? '💀 Assassin… Partie perdue !'
              : game.mode === 'coop'
                ? '🎉 Gagné ! Toutes les cartes trouvées !'
                : game.winner === 'red'
                  ? '🟥 Équipe rouge gagne !'
                  : '🟦 Équipe bleue gagne !'}
          </h3>
          {isHost && <button className="btn btn-primary" onClick={onNewGame}>Rejouer</button>}
        </div>
      )}
      <GameLog log={game.log} />
    </div>
  );
}

function TeamPanel({ team, game, me, nameById, onAction }) {
  const t = game.teams[team];
  const label = team === 'red' ? 'Rouge' : 'Bleue';
  return (
    <div className={`cn-team cn-team-${team}`}>
      <h4>{team === 'red' ? '🟥' : '🟦'} Équipe {label}</h4>
      <div className="cn-role">
        <span>🕵️ Maître-espion :</span>
        <strong>{t.spymaster ? nameById[t.spymaster] || '—' : '(vide)'}</strong>
        <button className="btn btn-mini" onClick={() => onAction({ kind: 'assign', team, role: 'spymaster' })}>
          Prendre
        </button>
      </div>
      <div className="cn-role">
        <span>🔎 Agents :</span>
        <strong>{t.operatives.map((id) => nameById[id] || '?').join(', ') || '(vide)'}</strong>
        <button className="btn btn-mini" onClick={() => onAction({ kind: 'assign', team, role: 'operative' })}>
          Rejoindre
        </button>
      </div>
    </div>
  );
}

function Setup({ game, me, isHost, nameById, onAction }) {
  const canPlay = (t) => !!game.teams[t].spymaster && game.teams[t].operatives.length > 0;
  const redOk = canPlay('red');
  const blueOk = canPlay('blue');
  const ready = redOk || blueOk;
  const mode = redOk && blueOk ? 'versus' : ready ? 'coop' : null;
  return (
    <div className="cn-setup card">
      <h3>Composez les équipes</h3>
      <p className="muted">
        Une équipe = un·e maître-espion (qui voit les couleurs) + au moins un·e agent.<br />
        🎮 <strong>2 équipes complètes</strong> = rouge contre bleu. <strong>Une seule équipe</strong> (2–3 joueuses) = mode coopératif.
      </p>
      <div className="cn-teams">
        <TeamPanel team="red" game={game} me={me} nameById={nameById} onAction={onAction} />
        <TeamPanel team="blue" game={game} me={me} nameById={nameById} onAction={onAction} />
      </div>
      {mode && (
        <p className="cn-mode-hint">
          {mode === 'versus' ? '⚔️ Partie en mode 2 équipes' : '🤝 Partie en mode coopératif'}
        </p>
      )}
      {isHost ? (
        <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => onAction({ kind: 'start' })}>
          {ready ? 'Démarrer la partie' : 'Il faut au moins 1 équipe : maître-espion + agent'}
        </button>
      ) : (
        <p className="muted">En attente que l'hôte démarre…</p>
      )}
    </div>
  );
}

function Scoreboard({ game, nameById }) {
  const turnLabel = game.turn === 'red' ? '🟥 Rouge' : '🟦 Bleue';
  return (
    <div className="cn-score">
      <span className="cn-count cn-count-red">{game.counts.red}</span>
      <div className="cn-turn">
        {game.phase === 'playing' && <>Au tour de {turnLabel}</>}
        {game.clue && (
          <div className="cn-clue">
            Indice : <strong>{game.clue.word}</strong> — {game.clue.count}
            {game.guessesLeft > 0 && <span className="muted"> ({game.guessesLeft} essai·s)</span>}
          </div>
        )}
      </div>
      <span className="cn-count cn-count-blue">{game.counts.blue}</span>
    </div>
  );
}

function Board({ game, me, onAction }) {
  const myTurnOperative = game.teams[game.turn].operatives.includes(me);
  const canGuess = game.phase === 'playing' && game.clue && myTurnOperative;

  return (
    <div className="cn-board">
      {game.board.map((card, i) => {
        const cls = ['cn-card'];
        if (card.revealed) cls.push('revealed', `c-${card.color}`);
        else if (card.color) cls.push(`hint-${card.color}`); // visible au maître-espion
        if (canGuess && !card.revealed) cls.push('clickable');
        return (
          <button
            key={i}
            className={cls.join(' ')}
            disabled={!canGuess || card.revealed}
            onClick={() => onAction({ kind: 'guess', index: i })}
          >
            {card.word}
          </button>
        );
      })}
    </div>
  );
}

function Controls({ game, me, onAction }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  if (game.phase !== 'playing') return null;

  const isActiveSpymaster = game.teams[game.turn].spymaster === me;
  const isActiveOperative = game.teams[game.turn].operatives.includes(me);

  if (isActiveSpymaster && !game.clue) {
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
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Ton indice (un seul mot)" />
        <input type="number" min="0" max="9" value={count} onChange={(e) => setCount(+e.target.value)} className="cn-count-input" />
        <button className="btn btn-primary">Donner l'indice</button>
      </form>
    );
  }

  if (isActiveOperative && game.clue) {
    return (
      <div className="cn-controls">
        <span className="muted">Clique sur une carte pour deviner, ou…</span>
        <button className="btn btn-secondary" onClick={() => onAction({ kind: 'pass' })}>Passer le tour</button>
      </div>
    );
  }

  return <p className="muted cn-wait">En attente du jeu de l'autre équipe…</p>;
}

function GameLog({ log }) {
  return (
    <div className="cn-log">
      {log.map((line, i) => (
        <div key={i} className="cn-log-line">{line}</div>
      ))}
    </div>
  );
}

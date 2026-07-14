import { useEffect, useState } from 'react';
import { Eye, Crown, Users, Check, SkipForward, Sparkles, ShieldCheck, Timer, UserSearch, Swords, Handshake } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import chatgptLogo from '../assets/chatgpt.svg';

const CLUE_COUNTS = Array.from({ length: 10 }, (_, value) => value);

function sideMembers(team) {
  return [...new Set([...(team.spymasters || []), team.spymaster, ...(team.operatives || [])].filter(Boolean))];
}
function spymasters(team) {
  return [...new Set([...(team.spymasters || []), team.spymaster].filter(Boolean))];
}

// Affiche le jeu Code Names. Reçoit la vue personnalisée du serveur.
export default function Codenames({ room, isHost, onAction, onNewGame }) {
  const game = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.ai = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.ai = chatgptLogo;
  const ids = { nameById, genderById, avatarById };

  // Mode Duo ChatGPT : tout le monde rejoint le côté rouge automatiquement.
  const onRed = game && sideMembers(game.teams.red).includes(me);
  const onBlue = game && sideMembers(game.teams.blue).filter((x) => x !== 'ai').includes(me);
  useEffect(() => {
    if (game?.phase === 'setup' && game.uiMode === 'ia' && !onRed && !onBlue) {
      onAction({ kind: 'assign', team: 'red', role: 'operative' });
    }
  }, [game?.phase, game?.uiMode, onRed, onBlue]);

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
    return <Setup game={game} me={me} isHost={isHost} ids={ids} onAction={onAction} />;
  }

  return (
    <div className="cn fade-up">
      <Head game={game} me={me} ids={ids} />
      {game.ai && !game.aiKey && (
        <div className="cn-warn">⚠️ Clé API OpenAI absente sur le serveur — ChatGPT passera ses tours.</div>
      )}
      <Board game={game} me={me} nameById={nameById} onAction={onAction} />
      <Controls game={game} me={me} onAction={onAction} />
      {game.phase === 'over' && <Over game={game} isHost={isHost} onNewGame={onNewGame} />}
    </div>
  );
}

/* ---------- Avatars empilés d'un camp ---------- */
function Faces({ ids, members, size = 22 }) {
  return (
    <span className="cn-faces">
      {members.slice(0, 5).map((id) => (
        <Avatar key={id} name={ids.nameById[id]} gender={ids.genderById[id]} avatar={ids.avatarById[id]} size={size} />
      ))}
      {members.length > 5 && <span className="cn-faces-more">+{members.length - 5}</span>}
    </span>
  );
}

/* ---------- RÉGLAGES (mode + équipes), dans le salon ---------- */
const MODES = [
  { key: 'versus', title: 'Versus', desc: '2 équipes qui s\'affrontent (4+)' },
  { key: 'duet', title: 'Duo coop', desc: 'Ensemble contre le jeu (2-3)' },
  { key: 'ia', title: 'Duo ChatGPT', desc: 'ChatGPT donne et devine (1+)' },
];

function Setup({ game, me, isHost, ids, onAction }) {
  const { nameById } = ids;
  const uiMode = game.uiMode;

  const canPlayTeam = (t) => spymasters(game.teams[t]).length > 0 && (game.teams[t].operatives || []).length > 0;
  const manned = (t) => sideMembers(game.teams[t]).length > 0;
  const ready = uiMode === 'versus' ? (canPlayTeam('red') && canPlayTeam('blue'))
    : uiMode === 'duet' ? (manned('red') && manned('blue'))
      : uiMode === 'ia' ? sideMembers(game.teams.red).length > 0
        : false;
  const notReadyLabel = uiMode === 'versus' ? 'Il faut 1 maître-espionne + 1 agente par équipe'
    : uiMode === 'duet' ? 'Il faut au moins 1 joueuse de chaque côté'
      : uiMode === 'ia' ? 'En attente d\'au moins 1 joueuse'
        : 'Choisis d\'abord un mode';

  return (
    <div className="cn-setup card">
      <h3 className="section-title"><UserSearch size={20} /> Code Names</h3>

      {/* Choix du mode par l'hôte, dans le salon */}
      <div className="cn-modes">
        {MODES.map((m) => (
          <button key={m.key} type="button"
            className={`cn-mode-btn ${uiMode === m.key ? 'on' : ''}`}
            disabled={!isHost}
            onClick={() => onAction({ kind: 'mode', mode: m.key })}>
            <span className="cn-mode-ic">
              {m.key === 'versus' ? <Swords size={17} /> : m.key === 'duet' ? <Handshake size={17} />
                : <img src={chatgptLogo} alt="" width={17} height={17} style={{ borderRadius: 4 }} />}
            </span>
            <b>{m.title}</b>
            <small>{m.desc}</small>
          </button>
        ))}
      </div>
      {!uiMode && <p className="muted" style={{ textAlign: 'center' }}>{isHost ? 'Choisis un mode pour commencer 👆' : 'L\'hôte choisit le mode…'}</p>}

      {uiMode === 'versus' && (
        <div className="cn-teams">
          {['red', 'blue'].map((side) => {
            const t = game.teams[side];
            return (
              <div key={side} className={`cn-team cn-team-${side}`}>
                <h4>Équipe {side === 'red' ? 'Rouge' : 'Bleue'}</h4>
                <div className="cn-role">
                  <Crown size={15} /> <span>Espionne :</span>
                  <strong>{spymasters(t).map((id) => nameById[id] || '?').join(', ') || '—'}</strong>
                  <button className="btn btn-secondary btn-mini" onClick={() => onAction({ kind: 'assign', team: side, role: 'spymaster' })}>J'y vais</button>
                </div>
                <div className="cn-role">
                  <Users size={15} /> <span>Agentes :</span>
                  <strong>{(t.operatives || []).map((id) => nameById[id] || '?').join(', ') || '—'}</strong>
                  <button className="btn btn-secondary btn-mini" onClick={() => onAction({ kind: 'assign', team: side, role: 'operative' })}>J'y vais</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uiMode === 'duet' && (
        <div className="cn-teams">
          {['red', 'blue'].map((side) => {
            const members = sideMembers(game.teams[side]);
            const mine = members.includes(me);
            return (
              <div key={side} className={`cn-team cn-team-${side}`}>
                <h4>Côté {side === 'red' ? 'Rouge' : 'Bleu'}</h4>
                <ul className="duet-members">
                  {members.length === 0
                    ? <li className="muted">Personne</li>
                    : members.map((id) => <li key={id}>{nameById[id] || '?'}</li>)}
                </ul>
                <button className={`btn btn-mini ${mine ? 'btn-ghost' : 'btn-secondary'}`} disabled={mine}
                  onClick={() => onAction({ kind: 'assign', team: side, role: 'operative' })}>
                  {mine ? 'Tu es ici' : 'Rejoindre'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {uiMode === 'ia' && (
        <div className="cn-teams">
          <div className="cn-team cn-team-red">
            <h4>Côté Rouge — vous</h4>
            <ul className="duet-members">
              {sideMembers(game.teams.red).map((id) => <li key={id}>{nameById[id] || '?'}</li>)}
            </ul>
          </div>
          <div className="cn-team cn-team-blue">
            <h4>Côté Bleu</h4>
            <div className="cn-ai-side">
              <img src={chatgptLogo} alt="ChatGPT" width={34} height={34} style={{ borderRadius: 10 }} />
              <div>
                <b>ChatGPT</b>
                <small className="muted" style={{ display: 'block' }}>donne ses indices et devine les vôtres</small>
              </div>
            </div>
            {!game.aiKey && <p className="cn-warn" style={{ marginTop: 8 }}>⚠️ Clé API OpenAI absente sur le serveur.</p>}
          </div>
        </div>
      )}

      {uiMode === 'ia' && (
        <p className="cn-hint-text">Objectif commun : trouver les <strong>15 agents</strong> en <strong>9 tours</strong>, sans toucher d'assassin. ChatGPT tient le côté bleu.</p>
      )}

      {isHost ? (
        <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => onAction({ kind: 'start' })}>
          {ready ? 'Démarrer la partie' : notReadyLabel}
        </button>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>En attente que l'hôte démarre…</p>
      )}
    </div>
  );
}

/* ---------- BANDEAU DU HAUT : équipes, tour, points, indice ---------- */
function Head({ game, me, ids }) {
  const duet = game.mode === 'duet';
  const cluePill = game.clue && (
    <span className="cn-clue-pill">
      « {game.clue.word} » — {game.clue.count}
      {game.guessesLeft > 0 && <span className="muted"> · {game.guessesLeft} essai{game.guessesLeft > 1 ? 's' : ''}</span>}
    </span>
  );

  const membersOf = (side) => sideMembers(game.teams[side]);
  const activeSide = game.turn;

  // Ligne d'état : qui fait quoi, de MON point de vue.
  let status = null;
  if (game.phase === 'playing') {
    if (game.aiThinking) status = <strong>ChatGPT réfléchit…</strong>;
    else if (game.isClueGiver && !game.clue) status = <strong>À toi de donner un indice !</strong>;
    else if (game.isClueGiver && game.clue && game.ai) status = <strong>ChatGPT devine ton indice…</strong>;
    else if (game.isGuesser && game.clue) status = <strong>À toi de deviner !</strong>;
    else if (duet) status = <>C'est au côté <b>{activeSide === 'red' ? 'rouge' : 'bleu'}</b> de faire deviner</>;
    else status = <>L'équipe <b className={activeSide}>{activeSide === 'red' ? 'rouge' : 'bleue'}</b> joue</>;
  }

  return (
    <div className="cn-headwrap">
      <div className="cn-head">
        <div className={`cn-side red ${activeSide === 'red' && game.phase === 'playing' ? 'active' : ''}`}>
          <div className="cn-side-top">
            <span className="cn-side-name">Rouge</span>
            {!duet && <span className="cn-side-count">{game.counts?.red ?? '–'}</span>}
          </div>
          <Faces ids={ids} members={membersOf('red')} />
          {!duet && <small className="cn-side-sub">à trouver</small>}
          {activeSide === 'red' && game.phase === 'playing' && <span className="cn-side-turn">🗣️ fait deviner</span>}
        </div>

        <div className="cn-head-mid">
          {duet ? (
            <>
              <span className="duet-chip agents"><ShieldCheck size={14} /> {game.agentsFound}/{game.agentsTotal}</span>
              <span className="duet-chip turns"><Timer size={14} /> {game.turnsLeft} tours</span>
            </>
          ) : (
            <span className="cn-vs">VS</span>
          )}
        </div>

        <div className={`cn-side blue ${activeSide === 'blue' && game.phase === 'playing' ? 'active' : ''}`}>
          <div className="cn-side-top">
            <span className="cn-side-name">{game.ai ? 'ChatGPT' : 'Bleu'}</span>
            {!duet && <span className="cn-side-count">{game.counts?.blue ?? '–'}</span>}
          </div>
          <Faces ids={ids} members={membersOf('blue')} />
          {!duet && <small className="cn-side-sub">à trouver</small>}
          {activeSide === 'blue' && game.phase === 'playing' && <span className="cn-side-turn">🗣️ fait deviner</span>}
        </div>
      </div>

      {(status || cluePill) && (
        <div className="cn-statusline">
          {status}
          {cluePill}
        </div>
      )}
    </div>
  );
}

/* ---------- PLATEAU ---------- */
function Board({ game, me, nameById, onAction }) {
  const canGuess = game.phase === 'playing' && game.clue && game.isGuesser;
  const rawSelection = game.selections?.[me];
  const mySelections = Array.isArray(rawSelection) ? rawSelection : rawSelection == null ? [] : [rawSelection];

  const pickers = {};
  for (const [uid, idx] of Object.entries(game.selections || {})) {
    const indexes = Array.isArray(idx) ? idx : [idx];
    for (const one of indexes) (pickers[one] ||= []).push(nameById[uid] || '?');
  }

  return (
    <div className="cn-board" lang="fr">
      {game.board.map((card, i) => {
        const cls = ['cn-card'];
        // Texte auto-ajusté : plus le mot est long, plus la police se réduit.
        if (card.word.length >= 11) cls.push('w3');
        else if (card.word.length >= 8) cls.push('w2');
        if (card.revealed) cls.push('revealed', `c-${card.color}`);
        else {
          if (card.color) cls.push(`hint-${card.color}`); // versus : vue maître-espionne
          if (card.hint) cls.push(`hint-${card.hint}`);    // duo : ma clé
        }
        if (mySelections.includes(i)) cls.push('selected-me');
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
        className="cn-controls cn-clue-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          onAction({ kind: 'clue', word: word.trim(), count });
          setWord('');
          setCount(1);
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Ton indice (un seul mot)" />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="cn-count-select input"
          aria-label="Nombre de mots à faire deviner"
        >
          {CLUE_COUNTS.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <button className="btn btn-primary"><Eye size={17} /> Donner l'indice</button>
      </form>
    );
  }

  if (game.isGuesser && game.clue) {
    const rawSelection = game.selections?.[me];
    const mySelections = Array.isArray(rawSelection) ? rawSelection : rawSelection == null ? [] : [rawSelection];
    return (
      <div className="cn-controls">
        {mySelections.length === 0 && <span className="muted">Touche un mot pour le présélectionner, puis valide :</span>}
        {mySelections.map((idx) => (
          <button key={idx} className="btn btn-primary" onClick={() => onAction({ kind: 'confirm', index: idx })}>
            <Check size={17} /> {game.board[idx]?.word}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => onAction({ kind: 'pass' })}><SkipForward size={16} /> Passer</button>
      </div>
    );
  }

  return null;
}

/* ---------- FIN ---------- */
function Over({ game, isHost, onNewGame }) {
  let title;
  if (game.mode === 'duet') {
    title = game.result === 'won' ? 'Gagné ! Les 15 agents sont trouvés !' : 'Perdu… ce sera mieux la prochaine fois !';
  } else {
    title = game.winner === 'red' ? "L'équipe rouge gagne !" : "L'équipe bleue gagne !";
  }
  return (
    <div className="cn-over">
      <h3>{title}</h3>
      {isHost && <button className="btn btn-primary" onClick={onNewGame}><Sparkles size={18} /> Rejouer</button>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Shuffle, Check, Anchor, Crosshair, Ship, Sparkles, Waves } from 'lucide-react';
import { burstAtEl, winConfetti, boomSound, splashSound } from '../effects.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default function Battleship({ room, isHost, onAction, onNewGame }) {
  const game = room.game;
  const me = room.me.id;
  const wrapRef = useRef(null);
  const lastSeq = useRef(0);
  const [shaking, setShaking] = useState(false);

  // Auto-placement à l'arrivée (on s'assoit + flotte aléatoire).
  useEffect(() => {
    if (game.phase === 'placing' && !game.myBoard) onAction({ kind: 'shuffle' });
  }, [game.phase, !!game.myBoard]);

  // Effets quand un tir vient d'avoir lieu.
  useEffect(() => {
    const ev = game.lastEvent;
    if (!ev || lastSeq.current === ev.seq) return;
    lastSeq.current = ev.seq;
    const onEnemy = ev.by === me; // si J'AI tiré -> case sur la mer ennemie
    const el = document.querySelector(`[data-cell="${onEnemy ? 'enemy' : 'my'}-${ev.x}-${ev.y}"]`);
    if (ev.result === 'miss') {
      splashSound();
    } else {
      boomSound(ev.result === 'sunk');
      burstAtEl(el, ev.result === 'sunk');
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
  }, [game.lastEvent?.seq]);

  useEffect(() => {
    if (game.phase === 'over') {
      winConfetti();
      if (game.iWon) boomSound(true);
    }
  }, [game.phase]);

  return (
    <div className={`bs ${shaking ? 'screen-shake' : ''}`} ref={wrapRef}>
      {game.phase === 'placing' && <Placing game={game} onAction={onAction} />}
      {game.phase === 'playing' && <Playing game={game} me={me} onAction={onAction} />}
      {game.phase === 'over' && <Playing game={game} me={me} onAction={onAction} />}
      {game.phase === 'over' && (
        <div className="cn-over">
          <h3>{game.iWon ? 'Victoire ! Flotte ennemie coulée 🎉' : 'Défaite… ta flotte a sombré'}</h3>
          {isHost && <button className="btn btn-primary" onClick={onNewGame}><Sparkles size={18} /> Rejouer</button>}
        </div>
      )}
      <div className="cn-log">
        {game.log.map((l, i) => <div key={i} className="cn-log-line">{l}</div>)}
      </div>
    </div>
  );
}

/* ---- Placement ---- */
function Placing({ game, onAction }) {
  return (
    <div className="card bs-placing">
      <h3 className="section-title"><Anchor size={20} /> Place ta flotte</h3>
      <p className="cn-hint-text">
        Ta flotte est posée au hasard. <strong>Mélange</strong> jusqu'à ce qu'elle te plaise, puis clique <strong>Prêt</strong>.
        La bataille démarre quand vous êtes prêts tous les deux.
      </p>
      <Grid board={game.myBoard} kind="my" />
      <div className="cn-controls">
        {!game.myReady ? (
          <>
            <button className="btn btn-ghost" onClick={() => onAction({ kind: 'shuffle' })}><Shuffle size={16} /> Mélanger</button>
            <button className="btn btn-primary" onClick={() => onAction({ kind: 'ready', value: true })}><Check size={16} /> Je suis prêt</button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => onAction({ kind: 'ready', value: false })}>Annuler — pas prêt</button>
        )}
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        {!game.oppPresent ? 'En attente d\'un·e adversaire…'
          : game.oppReady ? 'Adversaire prêt ✓' : 'L\'adversaire place sa flotte…'}
      </p>
    </div>
  );
}

/* ---- Bataille ---- */
function Playing({ game, me, onAction }) {
  const myTurn = game.isMyTurn && game.phase === 'playing';
  return (
    <div className="bs-arena">
      <div className="bs-side">
        <h4 className="section-title"><Crosshair size={17} /> Mer ennemie {myTurn && <span className="bs-yourturn">à toi de tirer !</span>}</h4>
        <Grid board={game.enemyBoard} kind="enemy" canFire={myTurn} onFire={(x, y) => onAction({ kind: 'fire', x, y })} />
        <Fleet fleet={game.enemyFleet} label="Flotte adverse" />
      </div>
      <div className="bs-side">
        <h4 className="section-title"><Ship size={17} /> Ma flotte {!myTurn && game.phase === 'playing' && <span className="muted">(tour adverse)</span>}</h4>
        <Grid board={game.myBoard} kind="my" />
        <Fleet fleet={game.myFleet} label="Ma flotte" />
      </div>
    </div>
  );
}

function Fleet({ fleet, label }) {
  if (!fleet) return null;
  const left = fleet.filter((s) => !s.sunk).length;
  return (
    <div className="bs-fleet">
      <span className="muted">{label} : {left}/{fleet.length}</span>
      <div className="bs-fleet-ships">
        {fleet.map((s, i) => (
          <span key={i} className={`bs-ship-pip ${s.sunk ? 'sunk' : ''}`} title={s.name}>
            {Array.from({ length: s.size }).map((_, k) => <i key={k} />)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- Grille 10x10 ---- */
function Grid({ board, kind, canFire, onFire }) {
  if (!board) return <div className="bs-grid-empty muted">Préparation…</div>;
  return (
    <div className="bs-grid-wrap">
      <div className="bs-grid">
        {board.map((row, y) =>
          row.map((cell, x) => {
            const cls = ['bs-cell'];
            if (kind === 'my') {
              if (cell.ship) cls.push('ship');
              if (cell.fired && cell.ship) cls.push(cell.sunk ? 'sunk' : 'hit');
              else if (cell.fired) cls.push('miss');
            } else {
              if (cell.hit) cls.push(cell.sunk ? 'sunk' : 'hit');
              else if (cell.fired) cls.push('miss');
              else if (cell.ship) cls.push('ship');
              if (canFire && !cell.fired) cls.push('fireable');
            }
            const clickable = kind === 'enemy' && canFire && !cell.fired;
            return (
              <button
                key={`${x}-${y}`}
                data-cell={`${kind}-${x}-${y}`}
                className={cls.join(' ')}
                disabled={!clickable}
                onClick={clickable ? () => onFire(x, y) : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

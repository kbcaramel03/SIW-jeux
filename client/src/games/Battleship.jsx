import { useEffect, useRef, useState } from 'react';
import { Shuffle, Check, Anchor, Crosshair, Ship, Sparkles, Bot } from 'lucide-react';
import { Button } from '@mui/material';
import { burstAtEl, winConfetti, boomSound, splashSound } from '../effects.js';

export default function Battleship({ room, isHost, onAction, onNewGame }) {
  const game = room.game;
  const me = room.me.id;
  const lastSeq = useRef(0);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (game.phase === 'placing' && !game.myBoard) onAction({ kind: 'shuffle' });
  }, [game.phase, !!game.myBoard]);

  useEffect(() => {
    const ev = game.lastEvent;
    if (!ev || lastSeq.current === ev.seq) return;
    lastSeq.current = ev.seq;
    const onEnemy = ev.by === me;
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
    // Confettis + son de victoire uniquement pour le gagnant.
    if (game.phase === 'over' && game.iWon) {
      winConfetti();
      boomSound(true);
    }
  }, [game.phase]);

  return (
    <div className="bs">
      <div className={shaking ? 'screen-shake' : ''}>
        {game.phase === 'placing' && <Placing game={game} onAction={onAction} />}
        {game.phase !== 'placing' && <Playing game={game} me={me} onAction={onAction} />}
        {game.phase === 'over' && (
          <div className="cn-over">
            <h3>{game.iWon ? 'Victoire ! Flotte ennemie coulée' : 'Défaite… ta flotte a sombré'}</h3>
            {isHost && <Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Placement ---- */
function Placing({ game, onAction }) {
  return (
    <div className="card bs-placing" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
      <h3 className="section-title"><Anchor size={20} /> Place ta flotte</h3>
      <p className="cn-hint-text">
        Bataille navale. Chaque joueuse dispose sa flotte en secret, puis on tire à tour de rôle pour repérer et couler les navires adverses : la première à envoyer toute la flotte ennemie par le fond gagne.
        Votre flotte est placée au hasard — <strong>mélangez</strong> jusqu'à ce qu'elle vous convienne, puis cliquez <strong>Prêt</strong>.
      </p>
      <Grid board={game.myBoard} kind="my" />
      <div className="cn-controls">
        {!game.myReady ? (
          <>
            <Button variant="outlined" startIcon={<Shuffle size={16} />} onClick={() => onAction({ kind: 'shuffle' })}>Mélanger</Button>
            <Button variant="contained" startIcon={<Check size={16} />} onClick={() => onAction({ kind: 'ready', value: true })}>Je suis prêt</Button>
          </>
        ) : (
          <Button variant="outlined" onClick={() => onAction({ kind: 'ready', value: false })}>Annuler — pas prêt</Button>
        )}
      </div>
      {!game.oppPresent && (
        <div className="bot-invite">
          <span className="bot-invite-label"><Bot size={16} /> Jouer contre ChatGPT :</span>
          <div className="cn-controls">
            <Button variant="outlined" color="success" size="small" onClick={() => onAction({ kind: 'bot', level: 'facile' })}>Facile</Button>
            <Button variant="outlined" color="secondary" size="small" onClick={() => onAction({ kind: 'bot', level: 'moyen' })}>Moyenne</Button>
            <Button variant="outlined" color="error" size="small" onClick={() => onAction({ kind: 'bot', level: 'difficile' })}>Difficile</Button>
          </div>
        </div>
      )}
      <p className="muted" style={{ textAlign: 'center' }}>
        {!game.oppPresent ? 'En attente d\'un·e adversaire… ou défie ChatGPT'
          : game.vsBot ? 'ChatGPT est prêt au combat !'
            : game.oppReady ? 'Adversaire prêt' : 'L\'adversaire place sa flotte…'}
      </p>
    </div>
  );
}

/* ---- Bataille ---- */
function Playing({ game, me, onAction }) {
  const myTurn = game.isMyTurn && game.phase === 'playing';
  const banner = game.phase === 'over'
    ? null
    : myTurn
      ? <div className="bs-turn-banner mine"><Crosshair size={18} /> À TOI DE TIRER</div>
      : <div className="bs-turn-banner theirs">{game.vsBot ? 'ChatGPT vise…' : 'Au tour de l\'adversaire — observe ses tirs'}</div>;

  return (
    <div>
      {banner}
      <div className="bs-arena">
        <div className={`bs-side bs-side-main ${myTurn ? 'active' : ''}`}>
          <h4 className="section-title"><Crosshair size={17} /> Mer ennemie</h4>
          <Grid board={game.enemyBoard} kind="enemy" canFire={myTurn} onFire={(x, y) => onAction({ kind: 'fire', x, y })} />
          <Fleet fleet={game.enemyFleet} label="Flotte adverse restante" />
        </div>
        <div className="bs-side bs-side-mine">
          <h4 className="section-title"><Ship size={16} /> Ma flotte</h4>
          <Grid board={game.myBoard} kind="my" small />
          <Fleet fleet={game.myFleet} label="Ma flotte restante" />
        </div>
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
function Grid({ board, kind, canFire, onFire, small }) {
  if (!board) return <div className="bs-grid-empty muted">Préparation…</div>;
  return (
    <div className="bs-grid-wrap">
      <div className={`bs-grid ${small ? 'sm' : ''}`}>
        {board.map((row, y) =>
          row.map((cell, x) => {
            const cls = ['bs-cell'];
            if (cell.seg) cls.push('ship', `orient-${cell.seg.orient}`, `part-${cell.seg.part}`);
            if (kind === 'my') {
              if (cell.fired && cell.ship) cls.push(cell.sunk ? 'sunk' : 'hit');
              else if (cell.fired) cls.push('miss');
            } else {
              if (cell.hit) cls.push(cell.sunk ? 'sunk' : 'hit');
              else if (cell.fired) cls.push('miss');
              if (canFire && !cell.fired) cls.push('fireable');
            }
            const clickable = kind === 'enemy' && canFire && !cell.fired;
            return (
              <button
                key={`${x}-${y}`}
                data-cell={`${kind}-${x}-${y}`}
                className={cls.join(' ')}
                disabled={!clickable}
                onClick={clickable ? (e) => { e.currentTarget.blur(); onFire(x, y); } : undefined}
              >
                {cell.seg?.head && <Ship className="ship-ic" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

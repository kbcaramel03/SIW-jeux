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

/* ---- Bateau entier (SVG étiré sur toutes ses cases) ---- */
function BoatShape({ len }) {
  const w = len * 20;
  return (
    <svg viewBox={`0 0 ${w} 20`} preserveAspectRatio="none" className="bs-boat-svg">
      {/* coque : poupe arrondie à gauche, proue effilée à droite */}
      <path className="hull" d={`M2.5 10 Q2.5 4 9 3.2 L ${w - 8} 3.2 Q ${w - 3} 5.5 ${w - 1.5} 10 Q ${w - 3} 14.5 ${w - 8} 16.8 L 9 16.8 Q2.5 16 2.5 10 Z`} />
      {/* pont */}
      <rect className="deck" x={6} y={7.4} width={w - 13} height={5.2} rx={2.6} />
      {/* hublots : un par case */}
      {Array.from({ length: len }).map((_, i) => (
        <circle key={i} className="win" cx={i * 20 + 10} cy={10} r={2.1} />
      ))}
    </svg>
  );
}

// Superposition des bateaux sur la grille (positions en % : 1 case = 10 %).
// Pendant un glisser, la position est pilotée en direct dans le DOM (fluide).
function Boats({ ships, handlers }) {
  if (!ships) return null;
  return (
    <>
      {ships.map((s) => {
        const style = {
          left: `${s.x * 10}%`,
          top: `${s.y * 10}%`,
          width: `${s.len * 10}%`,
          height: '10%',
        };
        if (!s.horizontal) {
          style.transformOrigin = `${50 / s.len}% 50%`;
          style.transform = 'rotate(90deg)';
        }
        return (
          <div
            key={s.id}
            className={`bs-boat ${s.sunk ? 'sunk' : ''} ${handlers ? 'tappable' : ''}`}
            style={style}
            onPointerDown={handlers ? (e) => handlers.down(e, s) : undefined}
            onPointerMove={handlers ? handlers.move : undefined}
            onPointerUp={handlers ? handlers.up : undefined}
            onPointerCancel={handlers ? handlers.up : undefined}
          >
            <BoatShape len={s.len} />
          </div>
        );
      })}
    </>
  );
}

/* ---- Placement : glisser un bateau pour le déplacer, le toucher pour pivoter ---- */
function Placing({ game, onAction }) {
  const ships = game.myShips || [];
  const dragRef = useRef(null);

  // Fluidité : pendant le glisser on bouge le DOM directement (aucun re-rendu
  // React à chaque mouvement de doigt), et on ne pose l'état qu'au relâcher.
  function boatDown(e, s) {
    if (game.myReady) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* simulé */ }
    const box = e.currentTarget.closest('.bs-gridbox')?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = { s, el: e.currentTarget, cell: box.width / 10, startX: e.clientX, startY: e.clientY, moved: false };
  }
  function boatMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.cell;
    const dy = (e.clientY - d.startY) / d.cell;
    if (!d.moved && Math.sqrt(dx * dx + dy * dy) < 0.35) return; // pas encore un vrai glisser
    d.moved = true;
    d.el.style.left = `${(d.s.x + dx) * 10}%`;
    d.el.style.top = `${(d.s.y + dy) * 10}%`;
    d.el.classList.add('selected');
  }
  function boatUp(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const s = d.s;
    d.el.classList.remove('selected');
    if (!d.moved) {
      // Simple touche (sans glisser) : le bateau pivote sur place (borné).
      const x = Math.min(s.x, s.horizontal ? 9 : 10 - s.len);
      const y = Math.min(s.y, s.horizontal ? 10 - s.len : 9);
      onAction({ kind: 'place', id: s.id, x, y, horizontal: !s.horizontal });
      return;
    }
    // Dépose : on aimante à la case la plus proche, bornée dans la mer.
    const dx = (e.clientX - d.startX) / d.cell;
    const dy = (e.clientY - d.startY) / d.cell;
    const nx = Math.max(0, Math.min(s.horizontal ? 10 - s.len : 9, Math.round(s.x + dx)));
    const ny = Math.max(0, Math.min(s.horizontal ? 9 : 10 - s.len, Math.round(s.y + dy)));
    // On recale tout de suite sur la grille (le serveur confirmera derrière).
    d.el.style.left = `${nx * 10}%`;
    d.el.style.top = `${ny * 10}%`;
    onAction({ kind: 'place', id: s.id, x: nx, y: ny, horizontal: s.horizontal });
  }

  return (
    <div className="card bs-placing" style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: 'var(--shadow)' }}>
      <h3 className="section-title"><Anchor size={20} /> Place ta flotte</h3>
      <p className="cn-hint-text">
        <strong>Fais glisser</strong> un bateau pour le déplacer, <strong>touche-le</strong> (sans bouger) pour le pivoter.
        Ou <strong>mélange</strong> jusqu'à ce que ça te plaise, puis <strong>Prête</strong> !
      </p>
      <Grid board={game.myBoard} kind="my" ships={ships}
        boatHandlers={!game.myReady ? { down: boatDown, move: boatMove, up: boatUp } : null} />
      <div className="cn-controls">
        {!game.myReady ? (
          <>
            <Button variant="outlined" startIcon={<Shuffle size={16} />} onClick={() => onAction({ kind: 'shuffle' })}>Mélanger</Button>
            <Button variant="contained" startIcon={<Check size={16} />} onClick={() => onAction({ kind: 'ready', value: true })}>Je suis prête</Button>
          </>
        ) : (
          <Button variant="outlined" onClick={() => onAction({ kind: 'ready', value: false })}>Annuler — pas prête</Button>
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

/* ---- Bataille : mer ennemie pleine largeur, ma flotte en petit dessous ---- */
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
          <Grid board={game.enemyBoard} kind="enemy" ships={game.enemyShips}
            canFire={myTurn} onFire={(x, y) => onAction({ kind: 'fire', x, y })} />
          <Fleet fleet={game.enemyFleet} label="Flotte adverse restante" />
        </div>
        <div className="bs-side bs-side-mine">
          <h4 className="section-title"><Ship size={16} /> Ma flotte</h4>
          <Grid board={game.myBoard} kind="my" ships={game.myShips} small />
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

/* ---- Grille 10x10 + bateaux entiers par-dessus ---- */
function Grid({ board, kind, canFire, onFire, small, ships, boatHandlers }) {
  if (!board) return <div className="bs-grid-empty muted">Préparation…</div>;
  return (
    <div className="bs-grid-wrap">
      <div className={`bs-gridbox ${small ? 'sm' : ''}`}>
        <div className={`bs-grid ${small ? 'sm' : ''}`}>
          {board.map((row, y) =>
            row.map((cell, x) => {
              const cls = ['bs-cell'];
              if (kind === 'my') {
                if (cell.fired && cell.ship) cls.push(cell.sunk ? 'sunk' : 'hit');
                else if (cell.fired) cls.push('miss');
              } else {
                if (cell.hit) cls.push(cell.sunk ? 'sunk' : 'hit');
                else if (cell.fired) cls.push('miss');
                if (canFire && !cell.fired) cls.push('fireable');
              }
              const fireClick = kind === 'enemy' && canFire && !cell.fired;
              return (
                <button
                  key={`${x}-${y}`}
                  data-cell={`${kind}-${x}-${y}`}
                  className={cls.join(' ')}
                  disabled={!fireClick}
                  onClick={fireClick ? (e) => { e.currentTarget.blur(); onFire(x, y); } : undefined}
                />
              );
            })
          )}
        </div>
        <Boats ships={ships} handlers={boatHandlers} />
      </div>
    </div>
  );
}

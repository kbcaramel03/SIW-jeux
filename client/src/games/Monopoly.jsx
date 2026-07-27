import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Dices, Home, Landmark, ArrowLeftRight, Gavel, KeyRound } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';
import botAvatar from '../assets/chatgpt.png';

// ---- COPIE du plateau de server/games/monopoly.js (garder synchronisé). ----
const BOARD = [
  { t: 'go', name: 'Départ' },
  { t: 'prop', name: 'Bd de Belleville', price: 60, group: 'marron', rents: [2, 10, 30, 90, 160, 250], maison: 50 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Rue Lecourbe', price: 60, group: 'marron', rents: [4, 20, 60, 180, 320, 450], maison: 50 },
  { t: 'taxe', name: 'Impôts sur le revenu', amount: 200 },
  { t: 'gare', name: 'Gare Montparnasse', price: 200 },
  { t: 'prop', name: 'Rue de Vaugirard', price: 100, group: 'ciel', rents: [6, 30, 90, 270, 400, 550], maison: 50 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Rue de Courcelles', price: 100, group: 'ciel', rents: [6, 30, 90, 270, 400, 550], maison: 50 },
  { t: 'prop', name: 'Av. de la République', price: 120, group: 'ciel', rents: [8, 40, 100, 300, 450, 600], maison: 50 },
  { t: 'prison', name: 'Prison' },
  { t: 'prop', name: 'Bd de la Villette', price: 140, group: 'rose', rents: [10, 50, 150, 450, 625, 750], maison: 100 },
  { t: 'cie', name: 'Cie d\'Électricité', price: 150 },
  { t: 'prop', name: 'Av. de Neuilly', price: 140, group: 'rose', rents: [10, 50, 150, 450, 625, 750], maison: 100 },
  { t: 'prop', name: 'Rue de Paradis', price: 160, group: 'rose', rents: [12, 60, 180, 500, 700, 900], maison: 100 },
  { t: 'gare', name: 'Gare de Lyon', price: 200 },
  { t: 'prop', name: 'Av. Mozart', price: 180, group: 'orange', rents: [14, 70, 200, 550, 750, 950], maison: 100 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Bd Saint-Michel', price: 180, group: 'orange', rents: [14, 70, 200, 550, 750, 950], maison: 100 },
  { t: 'prop', name: 'Place Pigalle', price: 200, group: 'orange', rents: [16, 80, 220, 600, 800, 1000], maison: 100 },
  { t: 'parc', name: 'Parc Gratuit' },
  { t: 'prop', name: 'Av. Matignon', price: 220, group: 'rouge', rents: [18, 90, 250, 700, 875, 1050], maison: 150 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Bd Malesherbes', price: 220, group: 'rouge', rents: [18, 90, 250, 700, 875, 1050], maison: 150 },
  { t: 'prop', name: 'Av. Henri-Martin', price: 240, group: 'rouge', rents: [20, 100, 300, 750, 925, 1100], maison: 150 },
  { t: 'gare', name: 'Gare du Nord', price: 200 },
  { t: 'prop', name: 'Fbg Saint-Honoré', price: 260, group: 'jaune', rents: [22, 110, 330, 800, 975, 1150], maison: 150 },
  { t: 'prop', name: 'Place de la Bourse', price: 260, group: 'jaune', rents: [22, 110, 330, 800, 975, 1150], maison: 150 },
  { t: 'cie', name: 'Cie des Eaux', price: 150 },
  { t: 'prop', name: 'Rue La Fayette', price: 280, group: 'jaune', rents: [24, 120, 360, 850, 1025, 1200], maison: 150 },
  { t: 'gotojail', name: 'Allez en Prison !' },
  { t: 'prop', name: 'Av. de Breteuil', price: 300, group: 'vert', rents: [26, 130, 390, 900, 1100, 1275], maison: 200 },
  { t: 'prop', name: 'Av. Foch', price: 300, group: 'vert', rents: [26, 130, 390, 900, 1100, 1275], maison: 200 },
  { t: 'prop', name: 'Bd des Capucines', price: 320, group: 'vert', rents: [28, 150, 450, 1000, 1200, 1400], maison: 200 },
  { t: 'gare', name: 'Gare Saint-Lazare', price: 200 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Av. des Champs-Élysées', price: 350, group: 'bleu', rents: [35, 175, 500, 1100, 1300, 1500], maison: 200 },
  { t: 'taxe', name: 'Taxe de luxe', amount: 100 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Rue de la Paix', price: 400, group: 'bleu', rents: [50, 200, 600, 1400, 1700, 2000], maison: 200 },
];
const GROUPS = {};
BOARD.forEach((c, i) => { if (c.group) (GROUPS[c.group] = GROUPS[c.group] || []).push(i); });

const GROUP_COLORS = {
  marron: '#8b5a2b', ciel: '#7ec8ee', rose: '#d63f8c', orange: '#f28322',
  rouge: '#d23c31', jaune: '#f2c11f', vert: '#2e9c5c', bleu: '#2b5fd4',
};
const GROUP_NAMES = {
  marron: 'marron', ciel: 'bleu ciel', rose: 'rose', orange: 'orange',
  rouge: 'rouge', jaune: 'jaune', vert: 'vert', bleu: 'bleu foncé',
};
const SEAT_COLORS = ['#d23c31', '#2b5fd4', '#e8a51e', '#2e9c5c', '#8c44c9', '#e0632a'];
const CORNER_EMOJI = { go: '🏁', prison: '🚔', parc: '🅿️', gotojail: '👮' };
const TYPE_EMOJI = { chance: '❓', caisse: '📦', taxe: '💸', gare: '🚂', cie: '💡' };

// Position de la case i dans la grille 11×11 (Départ en bas à droite).
function cellPos(i) {
  if (i === 0) return { r: 11, c: 11 };
  if (i < 10) return { r: 11, c: 11 - i };
  if (i === 10) return { r: 11, c: 1 };
  if (i < 20) return { r: 11 - (i - 10), c: 1 };
  if (i === 20) return { r: 1, c: 1 };
  if (i < 30) return { r: 1, c: i - 19 };
  if (i === 30) return { r: 1, c: 11 };
  return { r: i - 29, c: 11 };
}
// Centre de la case en % du plateau (pour les pions animés qui glissent).
const UNITS = 1.55 * 2 + 9;
function axisPct(k) {
  const start = k === 1 ? 0 : 1.55 + (k - 2);
  const width = (k === 1 || k === 11) ? 1.55 : 1;
  return ((start + width / 2) / UNITS) * 100;
}
function centerPct(i) {
  const { r, c } = cellPos(i);
  return { left: axisPct(c), top: axisPct(r) };
}

// Un dé avec de vrais points.
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ value, rollKey }) {
  return (
    <div className="mono-die rolling" key={rollKey}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'mono-pip' : ''} />
      ))}
    </div>
  );
}

// Acte de propriété (fiche classique) — sert pour le détail, l'achat, l'enchère.
function Deed({ idx, g, nameById, colorBySeat }) {
  const c = BOARD[idx];
  const owner = g.owner[String(idx)];
  const head = c.group ? GROUP_COLORS[c.group] : c.t === 'gare' ? '#463c52' : '#7d8a94';
  return (
    <div className="mono-deed">
      <div className="mono-deed-head" style={{ background: head }}>
        {c.t === 'gare' ? '🚂 ' : c.t === 'cie' ? '💡 ' : ''}{c.name}
      </div>
      {c.rents && (
        <>
          <div className="mono-deed-row"><span>Loyer terrain nu</span><b>{c.rents[0]} €</b></div>
          <div className="mono-deed-row"><span>— groupe complet</span><b>{c.rents[0] * 2} €</b></div>
          {[1, 2, 3, 4].map((n) => (
            <div className="mono-deed-row" key={n}><span>Avec {n} maison{n > 1 ? 's' : ''}</span><b>{c.rents[n]} €</b></div>
          ))}
          <div className="mono-deed-row"><span>Avec un hôtel</span><b>{c.rents[5]} €</b></div>
          <div className="mono-deed-row"><span>Prix d'une maison</span><b>{c.maison} €</b></div>
        </>
      )}
      {c.t === 'gare' && (
        <>
          {[1, 2, 3, 4].map((n) => (
            <div className="mono-deed-row" key={n}><span>{n} gare{n > 1 ? 's' : ''} possédée{n > 1 ? 's' : ''}</span><b>{25 * 2 ** (n - 1)} €</b></div>
          ))}
        </>
      )}
      {c.t === 'cie' && (
        <>
          <div className="mono-deed-row"><span>1 compagnie</span><b>4 × les dés</b></div>
          <div className="mono-deed-row"><span>2 compagnies</span><b>10 × les dés</b></div>
        </>
      )}
      {c.t === 'taxe' && <div className="mono-deed-row"><span>À payer à la banque</span><b>{c.amount} €</b></div>}
      {c.price && (
        <div className="mono-deed-row total">
          <span>Prix</span><b>{c.price} €</b>
        </div>
      )}
      {c.price && <div className="mono-deed-row"><span>Hypothèque</span><b>{Math.floor(c.price / 2)} €</b></div>}
      {owner && (
        <div className="mono-deed-row total">
          <span>Propriété de</span>
          <b style={{ color: colorBySeat[owner] }}>{nameById[owner] || '?'}{g.mortgaged[String(idx)] ? ' (hyp.)' : ''}</b>
        </div>
      )}
    </div>
  );
}

export default function Monopoly({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;
  const colorBySeat = Object.fromEntries(g.seats.map((id, i) => [id, SEAT_COLORS[i % SEAT_COLORS.length]]));

  const [detail, setDetail] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [draft, setDraft] = useState(null); // { to, give:[], ask:[], giveCash, askCash }
  const [, forceTick] = useState(0);        // re-rendu du compte à rebours d'enchère
  const auctionRef = useRef(null);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winner === me) { winConfetti(); boomSound(true); }
  }, [g.phase]);
  useEffect(() => { if (g.dice) popSound(); }, [g.dice?.[0], g.dice?.[1], g.turn]);
  useEffect(() => { setDetail(null); }, [g.stage, g.buyIdx]);

  // Compte à rebours local de l'enchère (le serveur donne les secondes restantes).
  useEffect(() => {
    if (g.auction) auctionRef.current = { left: g.auction.secondsLeft, at: Date.now() };
  }, [g.auction?.bid, g.auction?.secondsLeft, g.auction?.idx]);
  useEffect(() => {
    if (!g.auction) return undefined;
    const t = setInterval(() => forceTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [!!g.auction]);
  const auctionLeft = g.auction && auctionRef.current
    ? Math.max(0, auctionRef.current.left - (Date.now() - auctionRef.current.at) / 1000)
    : 0;

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Landmark size={20} color="#2e9c5c" /> Monopoly — salle d'attente</h3>
        <p className="cn-hint-text">Le vrai Monopoly : achetez (ou laissez partir aux enchères !), encaissez les loyers, construisez de façon équilibrée, hypothéquez pour survivre, échangez des terrains entre vous, et gardez précieusement vos cartes « Libéré de prison ». Faillite = éliminée. Au bout de 60 tours, la plus riche gagne. 2 à 6 joueuses.</p>
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
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}
          {g.amSeated && !g.seats.includes('bot') && g.seats.length < 6 && <Button variant="outlined" color="secondary" onClick={() => onAction({ kind: 'bot' })}>Inviter ChatGPT</Button>}
        </div>
        {g.amSeated && g.seats.length < 2 && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const my = g.players[me];
  const myProps = Object.entries(g.owner).filter(([, uid]) => uid === me).map(([idx]) => Number(idx)).sort((a, b) => a - b);
  const propsOf = (uid) => Object.entries(g.owner).filter(([, o]) => o === uid).map(([idx]) => Number(idx)).sort((a, b) => a - b);
  const groupComplete = (i, uid) => BOARD[i].group && GROUPS[BOARD[i].group].every((gi) => g.owner[String(gi)] === uid);
  const groupHasHouses = (i) => BOARD[i].group && GROUPS[BOARD[i].group].some((gi) => (g.houses[String(gi)] || 0) > 0);

  const banner = g.phase === 'over'
    ? (g.winner === me ? 'Tu gagnes la partie ! 🎩' : `${nameById[g.winner] || '?'} gagne la partie !`)
    : g.stage === 'auction'
      ? `Enchères : ${BOARD[g.auction?.idx]?.name} !`
      : g.isMyTurn
        ? (g.stage === 'buy' ? `${BOARD[g.buyIdx].name} est à vendre !` : my?.jail ? `Prison — essai ${(my.jailTries || 0) + 1}/3` : 'À toi de jouer !')
        : `${nameById[g.turn] || '?'} joue… (tour ${g.round}/${g.roundCap})`;

  const caseCell = (i) => {
    const c = BOARD[i];
    const pos = cellPos(i);
    const ownerId = g.owner[String(i)];
    const houses = g.houses[String(i)] || 0;
    const corner = CORNER_EMOJI[c.t];
    const highlight = g.buyIdx === i || g.auction?.idx === i;
    return (
      <div key={i} className={`mono-cell ${corner ? 'corner' : ''} ${highlight ? 'highlight' : ''}`}
        style={{ gridRow: pos.r, gridColumn: pos.c }}
        onClick={() => setDetail(i)}>
        {c.group && (
          <div className="mono-cap" style={{ background: `linear-gradient(180deg, ${GROUP_COLORS[c.group]}, ${GROUP_COLORS[c.group]}cc)` }}>
            {houses > 0 && houses < 5 && Array.from({ length: houses }, (_, k) => <span key={k} className="mono-house" />)}
            {houses === 5 && <span className="mono-house hotel" />}
          </div>
        )}
        <div className="mono-cell-name">{corner || TYPE_EMOJI[c.t] || c.name.replace(/^(Bd|Av\.|Rue|Place|Fbg) (de |des |du |de la |d')?/, '')}</div>
        {c.price && <div className="mono-cell-price">{c.price} €</div>}
        {ownerId && <span className="mono-owner-dot" style={{ background: colorBySeat[ownerId] || '#888' }} />}
        {g.mortgaged[String(i)] && <div className="mono-mortgaged"><span>HYP</span></div>}
      </div>
    );
  };

  // Pions : couche animée au-dessus du plateau (glissent de case en case).
  const tokens = g.seats.filter((id) => g.players[id]?.alive).map((id, k, arr) => {
    const p = g.players[id];
    const { left, top } = centerPct(p.pos);
    const same = arr.filter((x) => g.players[x].pos === p.pos);
    const j = same.indexOf(id);
    const off = same.length > 1 ? (j - (same.length - 1) / 2) * 2.6 : 0;
    return (
      <span key={id} className="mono-token"
        style={{ left: `${left + off}%`, top: `${top + (same.length > 2 ? (j % 2) * 2.4 - 1.2 : 0)}%`, background: colorBySeat[id] }}
        title={nameById[id]} />
    );
  });

  const closeOverlays = () => { setDetail(null); setManageOpen(false); setTradeOpen(false); };

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="pool-players">
        {g.seats.map((id) => {
          const p = g.players[id];
          return (
            <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}
              style={{ opacity: p?.alive ? 1 : 0.45, borderColor: colorBySeat[id] }}>
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
              <span>{nameById[id] || '?'}</span>
              <b className="mono-cash-pill">{p?.cash} €</b>
              {(p?.gooj || 0) > 0 && <span title="Carte Libéré de prison">🔑{p.gooj > 1 ? `×${p.gooj}` : ''}</span>}
              {p?.jail && <span>🚔</span>}
              {!p?.alive && <span>💥</span>}
            </div>
          );
        })}
      </div>

      <div className="mono-wrap">
        <div className="mono-board">
          {BOARD.map((_, i) => caseCell(i))}

          <div className="mono-center">
            <div className="mono-logo">MONOPOLY</div>
            {g.dice && (
              <div className="mono-dice">
                <Die value={g.dice[0]} rollKey={`a${g.round}-${g.dice[0]}-${g.dice[1]}-${g.turn}`} />
                <Die value={g.dice[1]} rollKey={`b${g.round}-${g.dice[0]}-${g.dice[1]}-${g.turn}`} />
              </div>
            )}
            {g.lastCard && (
              <div className={`mono-card-draw ${g.lastCard.deck === 'Chance' ? 'chance' : 'caisse'}`}>
                <b>{g.lastCard.deck}</b> — {g.lastCard.text}
              </div>
            )}

            {g.phase === 'playing' && g.isMyTurn && g.stage === 'roll' && (
              <div className="mono-actions">
                <Button variant="contained" size="large" startIcon={<Dices size={20} />} onClick={() => onAction({ kind: 'roll' })}>
                  {my?.jail ? 'Tenter le double' : 'Lancer les dés'}
                </Button>
                {my?.jail && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {my.cash >= 50 && <Button variant="outlined" size="small" onClick={() => onAction({ kind: 'bail' })}>Payer 50 €</Button>}
                    {(my.gooj || 0) > 0 && (
                      <Button variant="outlined" size="small" startIcon={<KeyRound size={14} />} onClick={() => onAction({ kind: 'gooj' })}>
                        Ma carte
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {g.phase === 'playing' && g.players[me]?.alive && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {myProps.length > 0 && (
                  <Button variant="outlined" size="small" startIcon={<Home size={14} />} onClick={() => { closeOverlays(); setManageOpen(true); }}>
                    Gérer
                  </Button>
                )}
                {!g.trade && (
                  <Button variant="outlined" size="small" startIcon={<ArrowLeftRight size={14} />} onClick={() => {
                    closeOverlays();
                    setDraft({ to: g.seats.find((id) => id !== me && g.players[id].alive) || null, give: [], ask: [], giveCash: 0, askCash: 0 });
                    setTradeOpen(true);
                  }}>
                    Échanger
                  </Button>
                )}
              </div>
            )}
            <div className="mono-log">
              {g.log.slice().reverse().map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          <div className="mono-tokens">{tokens}</div>

          {/* Fiche d'une case */}
          {detail !== null && !manageOpen && !tradeOpen && (
            <div className="mono-overlay" onClick={() => setDetail(null)}>
              <div onClick={(e) => e.stopPropagation()}>
                <Deed idx={detail} g={g} nameById={nameById} colorBySeat={colorBySeat} />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Button size="small" variant="contained" color="inherit" onClick={() => setDetail(null)}>Fermer</Button>
                </div>
              </div>
            </div>
          )}

          {/* Achat : acte + choix (refuser = enchères, comme la vraie règle) */}
          {g.phase === 'playing' && g.isMyTurn && g.stage === 'buy' && detail === null && (
            <div className="mono-overlay">
              <div>
                <Deed idx={g.buyIdx} g={g} nameById={nameById} colorBySeat={colorBySeat} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                  <Button variant="contained" color="success" disabled={(my?.cash ?? 0) < BOARD[g.buyIdx].price}
                    onClick={() => onAction({ kind: 'buy' })}>
                    Acheter ({BOARD[g.buyIdx].price} €)
                  </Button>
                  <Button variant="outlined" color="inherit" startIcon={<Gavel size={16} />} onClick={() => onAction({ kind: 'pass' })}>
                    Aux enchères
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Enchère en cours */}
          {g.stage === 'auction' && g.auction && (
            <div className="mono-overlay">
              <div>
                <Deed idx={g.auction.idx} g={g} nameById={nameById} colorBySeat={colorBySeat} />
                <div className="mono-panel" style={{ marginTop: 8, padding: '10px 14px' }}>
                  <div className="mono-bid">
                    {g.auction.bid > 0 ? `${g.auction.bid} €` : 'Aucune offre'}
                  </div>
                  {g.auction.bidder && (
                    <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: colorBySeat[g.auction.bidder] }}>
                      {nameById[g.auction.bidder] || '?'} tient l'enchère
                    </div>
                  )}
                  <div className="mono-timerbar"><div style={{ width: `${(auctionLeft / 14) * 100}%` }} /></div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>
                    Adjugé dans {Math.ceil(auctionLeft)} s
                  </div>
                  {g.players[me]?.alive && g.auction.bidder !== me && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                      {[10, 25, 100].map((d) => {
                        const next = g.auction.bid + d;
                        return (
                          <Button key={d} variant="contained" size="small" disabled={next > (g.players[me]?.cash ?? 0)}
                            onClick={() => onAction({ kind: 'bid', amount: next })}>
                            {next} €
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gestion : construire / vendre / hypothéquer */}
          {manageOpen && (
            <div className="mono-overlay" onClick={() => setManageOpen(false)}>
              <div className="mono-panel" onClick={(e) => e.stopPropagation()}>
                <h4>Mes terrains — {my?.cash} € <span style={{ color: 'var(--ink-soft)', fontWeight: 600, fontSize: 12 }}>(banque : {g.bank.houses} 🏠 / {g.bank.hotels} 🏨)</span></h4>
                {myProps.length === 0 && <p className="muted">Tu ne possèdes rien pour l'instant.</p>}
                {myProps.map((i) => {
                  const c = BOARD[i];
                  const h = g.houses[String(i)] || 0;
                  const hyp = g.mortgaged[String(i)];
                  const canBuild = c.t === 'prop' && groupComplete(i, me) && !hyp;
                  const liftCost = Math.floor(c.price / 2) + Math.ceil(Math.floor(c.price / 2) / 10);
                  return (
                    <div key={i} className="mono-manage-row">
                      <span className="mono-group-dot" style={{ background: c.group ? GROUP_COLORS[c.group] : '#999' }} />
                      <span style={{ flex: 1, textDecoration: hyp ? 'line-through' : 'none' }}>{c.name}</span>
                      {c.t === 'prop' && canBuild && (
                        <>
                          <button className="mono-chip-btn" disabled={h <= 0} onClick={() => onAction({ kind: 'build', idx: i, sell: true })}>−</button>
                          <b style={{ width: 20, textAlign: 'center' }}>{h === 5 ? '🏨' : h}</b>
                          <button className="mono-chip-btn" disabled={h >= 5 || (my?.cash ?? 0) < c.maison} onClick={() => onAction({ kind: 'build', idx: i })}>+</button>
                          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{c.maison} €</span>
                        </>
                      )}
                      {hyp ? (
                        <button className="mono-chip-btn" disabled={(my?.cash ?? 0) < liftCost} onClick={() => onAction({ kind: 'mortgage', idx: i, lift: true })}>
                          Lever ({liftCost} €)
                        </button>
                      ) : (
                        <button className="mono-chip-btn" disabled={groupHasHouses(i)} title={groupHasHouses(i) ? 'Vends d\'abord les maisons du groupe' : ''}
                          onClick={() => onAction({ kind: 'mortgage', idx: i })}>
                          Hyp. (+{Math.floor(c.price / 2)} €)
                        </button>
                      )}
                    </div>
                  );
                })}
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <Button size="small" variant="contained" color="inherit" onClick={() => setManageOpen(false)}>Fermer</Button>
                </div>
              </div>
            </div>
          )}

          {/* Proposer un échange */}
          {tradeOpen && draft && (
            <div className="mono-overlay" onClick={() => setTradeOpen(false)}>
              <div className="mono-panel" onClick={(e) => e.stopPropagation()} style={{ width: 340 }}>
                <h4>Proposer un échange</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                  {g.seats.filter((id) => id !== me && g.players[id].alive).map((id) => (
                    <button key={id} className={`mono-chip-btn ${draft.to === id ? 'sel' : ''}`}
                      onClick={() => setDraft({ ...draft, to: id, ask: [], askCash: 0 })}>
                      {nameById[id] || '?'}
                    </button>
                  ))}
                </div>
                {draft.to && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 4px' }}>Je donne :</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {myProps.filter((i) => !groupHasHouses(i)).map((i) => (
                        <button key={i} className={`mono-chip-btn ${draft.give.includes(i) ? 'sel' : ''}`}
                          style={{ borderLeftColor: BOARD[i].group ? GROUP_COLORS[BOARD[i].group] : undefined, borderLeftWidth: 4 }}
                          onClick={() => setDraft({ ...draft, give: draft.give.includes(i) ? draft.give.filter((x) => x !== i) : [...draft.give, i] })}>
                          {BOARD[i].name}
                        </button>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                        + <input type="number" min="0" max={my?.cash ?? 0} value={draft.giveCash}
                          style={{ width: 64, borderRadius: 8, border: '1.5px solid #e0d5e5', padding: '3px 6px' }}
                          onChange={(e) => setDraft({ ...draft, giveCash: Math.max(0, Math.min(my?.cash ?? 0, Number(e.target.value) || 0)) })} /> €
                      </label>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 4px' }}>Contre :</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {propsOf(draft.to).filter((i) => !groupHasHouses(i)).map((i) => (
                        <button key={i} className={`mono-chip-btn ${draft.ask.includes(i) ? 'sel' : ''}`}
                          style={{ borderLeftColor: BOARD[i].group ? GROUP_COLORS[BOARD[i].group] : undefined, borderLeftWidth: 4 }}
                          onClick={() => setDraft({ ...draft, ask: draft.ask.includes(i) ? draft.ask.filter((x) => x !== i) : [...draft.ask, i] })}>
                          {BOARD[i].name}
                        </button>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                        + <input type="number" min="0" max={g.players[draft.to]?.cash ?? 0} value={draft.askCash}
                          style={{ width: 64, borderRadius: 8, border: '1.5px solid #e0d5e5', padding: '3px 6px' }}
                          onChange={(e) => setDraft({ ...draft, askCash: Math.max(0, Math.min(g.players[draft.to]?.cash ?? 0, Number(e.target.value) || 0)) })} /> €
                      </label>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  <Button variant="contained" size="small" disabled={!draft.to || (!draft.give.length && !draft.ask.length && !draft.giveCash && !draft.askCash)}
                    onClick={() => {
                      onAction({ kind: 'offer', to: draft.to, giveProps: draft.give, askProps: draft.ask, giveCash: draft.giveCash, askCash: draft.askCash });
                      setTradeOpen(false);
                    }}>
                    Proposer
                  </Button>
                  <Button variant="outlined" size="small" color="inherit" onClick={() => setTradeOpen(false)}>Annuler</Button>
                </div>
              </div>
            </div>
          )}

          {/* Échange reçu / en attente */}
          {g.trade && (g.trade.to === me || g.trade.from === me) && !tradeOpen && (
            <div className="mono-overlay">
              <div className="mono-panel" style={{ width: 300 }}>
                <h4><ArrowLeftRight size={16} /> Échange</h4>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '4px 0' }}>
                  <b style={{ color: colorBySeat[g.trade.from] }}>{nameById[g.trade.from] || '?'}</b> donne{' '}
                  {[...g.trade.giveProps.map((i) => BOARD[i].name), g.trade.giveCash ? `${g.trade.giveCash} €` : null].filter(Boolean).join(' + ') || 'rien'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '4px 0' }}>
                  contre {[...g.trade.askProps.map((i) => BOARD[i].name), g.trade.askCash ? `${g.trade.askCash} €` : null].filter(Boolean).join(' + ') || 'rien'}
                  {' '}de <b style={{ color: colorBySeat[g.trade.to] }}>{nameById[g.trade.to] || '?'}</b>
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
                  {g.trade.to === me ? (
                    <>
                      <Button variant="contained" color="success" size="small" onClick={() => onAction({ kind: 'tradeAccept' })}>Accepter</Button>
                      <Button variant="outlined" color="error" size="small" onClick={() => onAction({ kind: 'tradeRefuse' })}>Refuser</Button>
                    </>
                  ) : (
                    <Button variant="outlined" size="small" color="inherit" onClick={() => onAction({ kind: 'tradeCancel' })}>Retirer ma proposition</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

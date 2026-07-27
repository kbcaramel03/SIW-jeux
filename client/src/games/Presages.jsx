import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Moon } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';
import botAvatar from '../assets/chatgpt.png';

// ---- COPIE de la table des cartes de server/games/presages.js (garder synchronisé).
const COLORS = ['jaune', 'vert', 'rouge', 'bleu'];
const COLOR_HEX = { jaune: '#f2c11f', vert: '#3fae70', rouge: '#e0564a', bleu: '#5b8bea' };
const colorOfVal = (v) => (v <= 29 ? COLORS[(v - 1) % 4] : null);
const CARDS = {};
function def(v, sym, text) { CARDS[v] = { v, color: colorOfVal(v), sym, text }; }
def(1, '•', 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(2, '🟥', 'Défaussée si une carte rouge est en jeu.');
def(3, '▽', 'Défausse la carte verte la plus faible en jeu.');
def(4, '🟨', 'Défaussée si une carte jaune est en jeu.');
def(5, '✚✚', 'Si elle est défaussée, défausse aussi une carte au hasard de ta main.');
def(6, '•', 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(7, '△', 'Défausse la carte bleue la plus forte en jeu.');
def(8, '🟩', 'Défaussée si une carte verte est en jeu.');
def(9, '−', 'Ne peut pas remporter le pli.');
def(10, '◀', '⚡ Ta voisine de gauche mènera le prochain tour.');
def(11, '🟦', 'Défaussée si une carte bleue est en jeu.');
def(12, '▽', 'Défausse la carte jaune la plus faible en jeu.');
def(13, '•', 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(14, '✚', 'Aucun effet : solide et fiable.');
def(15, '△✚', 'La carte la plus forte du tour ne remporte pas le pli.');
def(16, '🟥', 'Défaussée si une carte rouge est en jeu.');
def(17, '👁', '⚡ Révèle à toutes ta carte la plus forte en main.');
def(18, '▽', 'Défausse la carte rouge la plus faible en jeu.');
def(19, '•', 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(20, '±▲', '⚡ Les suivantes doivent jouer plus fort que 20, si possible.');
def(21, '🟩', 'Défaussée si une carte verte est en jeu.');
def(22, '✚✚', 'Si elle est défaussée, défausse aussi une carte au hasard de ta main.');
def(23, '−', 'Ne peut pas remporter le pli.');
def(24, '△', 'Défausse la carte verte la plus forte en jeu.');
def(25, '▽▽', 'Défausse la carte la plus faible du tour.');
def(26, '±▼', '⚡ Les suivantes doivent jouer plus faible que 26, si possible.');
def(27, '△✚', 'La carte la plus forte du tour ne remporte pas le pli.');
def(28, '👁', '⚡ Révèle à toutes ta carte la plus forte en main.');
def(29, '△', 'Défausse la carte rouge la plus forte en jeu.');
for (let v = 30; v <= 35; v++) def(v, '☽', 'L\'Absolu — pure puissance, aucun effet.');

function ArcaneCard({ v, small, selected, illegal, discarded, winner, onClick }) {
  const c = CARDS[v];
  const cls = [
    'pres-card',
    c.color ? '' : 'absolu',
    small ? 'small' : '',
    selected ? 'sel' : '',
    illegal ? 'illegal' : '',
    discarded ? 'discarded' : '',
    winner ? 'winner-card' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--pc': c.color ? COLOR_HEX[c.color] : undefined }} onClick={onClick}>
      <span className="corner">{v}</span>
      <span className="val">{v}</span>
      <span className="sym">{c.sym}</span>
    </div>
  );
}

export default function Presages({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  nameById.bot = 'ChatGPT';
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  avatarById.bot = botAvatar;

  const [sel, setSel] = useState(null);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase]);
  useEffect(() => { setSel(null); }, [g.isMyTurn, g.manche]);
  useEffect(() => { if (g.played?.length) popSound(); }, [g.played?.length]);

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Moon size={20} color="#8a76a6" /> Présages — salle d'attente</h3>
        <p className="cn-hint-text">Jeu de défausse en équipes, sans se parler ! Chaque tour, chacune joue une carte : la plus forte remporte le pli et est défaussée, les autres reviennent en main… sauf si leur condition « Défaussez cette carte si… » se déclenche. Dès qu'une joueuse n'a plus qu'une carte, son équipe gagne la manche — 2 manches gagnées, c'est la victoire. Les Absolus (30-35) forment les équipes : le plus fort avec le plus faible. 4 à 6 joueuses.</p>
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
        {g.amSeated && g.seats.length < 4 && <p className="muted" style={{ textAlign: 'center' }}>Encore {4 - g.seats.length} joueuse(s) pour lancer…</p>}
      </div>
    );
  }

  const myTeam = g.teams.findIndex((t) => t.includes(me));
  const trick = g.played.length ? g.played.map((p) => ({ ...p, discarded: false })) : (g.lastTrick?.cards || []);
  const showingLast = !g.played.length && !!g.lastTrick;
  const legal = (card) => !g.constraint
    || (g.constraint.dir === 'up' ? card > g.constraint.val : card < g.constraint.val)
    || !g.hand.some((c) => (g.constraint.dir === 'up' ? c > g.constraint.val : c < g.constraint.val));

  const banner = g.phase === 'over'
    ? (g.winners?.includes(me) ? 'Ton équipe lit l\'avenir — victoire ! 🔮' : `${(g.winners || []).map((id) => nameById[id] || '?').join(' & ')} gagnent la partie !`)
    : g.onBreak
      ? 'Manche gagnée — on redistribue…'
      : g.isMyTurn
        ? (sel ? 'Confirme ta carte ou choisis-en une autre' : 'À toi : choisis une carte')
        : `${nameById[g.turn] || '?'} consulte les astres…`;

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="pres-teams" style={{ marginBottom: 8 }}>
        {g.teams.map((team, ti) => (
          <div key={ti} className="pres-team" style={{ borderColor: ti === myTeam ? '#f2c11f' : undefined, background: 'rgba(70,60,82,0.85)' }}>
            {team.map((id) => (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={20} />
                <span>{nameById[id] || '?'}</span>
                <b style={{ opacity: 0.8 }}>({g.handCounts[id]})</b>
                <span style={{ fontSize: 11, opacity: 0.7 }}>☽{g.absolus[id]}</span>
              </span>
            ))}
            <span className="stars">{'★'.repeat(g.wins[ti])}{'☆'.repeat(2 - g.wins[ti])}</span>
          </div>
        ))}
      </div>

      <div className="pres-table">
        <div style={{ color: '#cfc6e0', fontWeight: 700, fontSize: 13 }}>
          Manche {g.manche} {showingLast ? '· fin du pli' : `· ${nameById[g.leader] || '?'} mène`}
        </div>
        {g.constraint && (
          <div className="pres-constraint">
            {g.constraint.dir === 'up' ? `⚡ Jouez plus FORT que ${g.constraint.val} !` : `⚡ Jouez plus FAIBLE que ${g.constraint.val} !`}
          </div>
        )}
        <div className="pres-trick">
          {trick.length === 0 && <span style={{ color: '#8d8499', fontWeight: 600 }}>Les cartes du tour apparaîtront ici…</span>}
          {trick.map((p) => (
            <div key={`${p.by}-${p.card}`} className="pres-slot">
              <ArcaneCard v={p.card} small discarded={p.discarded} winner={showingLast && g.lastTrick?.winnerBy === p.by} />
              <span className="who">{p.by === g.turn && !showingLast ? '▶ ' : ''}{nameById[p.by] || '?'}</span>
            </div>
          ))}
        </div>
        <div className="pres-log">
          {g.log.slice().reverse().map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      {/* Ma main */}
      {g.phase === 'playing' && g.hand.length > 0 && (
        <>
          {sel && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <div className="pres-effect-hint">
              <b>{sel}{CARDS[sel].color ? ` · ${CARDS[sel].color}` : ' · Absolu'}</b> — {CARDS[sel].text}
              {g.isMyTurn && (
                <div style={{ marginTop: 6 }}>
                  <Button variant="contained" size="small" onClick={() => { onAction({ kind: 'play', card: sel }); setSel(null); }}>
                    Jouer cette carte
                  </Button>
                </div>
              )}
            </div>
          </div>}
          <div className="pres-hand">
            {g.hand.map((card) => (
              <ArcaneCard key={card} v={card}
                selected={sel === card}
                illegal={g.isMyTurn && !legal(card)}
                onClick={() => {
                  if (g.isMyTurn && !legal(card)) return;
                  setSel(sel === card ? null : card);
                }} />
            ))}
          </div>
        </>
      )}

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Play, Sparkles, Moon, Swords, Eye } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

const CAMP_LABEL = { shadow: 'Shadow 🌑', hunter: 'Hunter 🔆', neutral: 'Neutre ⚖️' };
const CAMP_COLORS = { shadow: '#8c44c9', hunter: '#f2c11f', neutral: '#7ec8ee' };
const AREA_EMOJI = { ermite: '🏚️', porte: '🌀', eglise: '⛪', cimetiere: '🪦', foret: '🌲', autel: '🗿' };

export default function ShadowHunters({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));

  const [picker, setPicker] = useState(null); // { kind: 'reveal' } pour la capacité

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase]);
  useEffect(() => { if (g.atk) popSound(); }, [g.atk?.by, g.atk?.target, g.atk?.dmg]);
  useEffect(() => { setPicker(null); }, [g.turn, g.stage]);

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Moon size={20} color="#8c44c9" /> Shadow Hunters — salle d'attente</h3>
        <p className="cn-hint-text">Rôles cachés : Shadows contre Hunters, plus des Neutres avec leurs objectifs perso. Déplacez-vous aux dés entre six lieux, piochez des cartes, donnez des Visions pour percer les identités… et attaquez (dégâts = |d6 − d4|) ! Révélez-vous pour libérer votre capacité — mais tout le monde saura qui vous êtes. 4 à 8 joueuses.</p>
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
        </div>
        {g.amSeated && g.seats.length < 4 && <p className="muted" style={{ textAlign: 'center' }}>Encore {4 - g.seats.length} joueuse(s) pour lancer…</p>}
      </div>
    );
  }

  const my = g.me;
  const myP = g.players[me] || {};
  const inMyZone = (id) => {
    const zone = g.zones.find((z) => z.includes(myP.area));
    return zone && zone.includes(g.players[id]?.area);
  };
  const areaById = Object.fromEntries(g.areas.map((a) => [a.id, a]));
  const alive = g.seats.filter((id) => g.players[id]?.alive);

  const stageHint = {
    move: 'lance les dés de déplacement',
    place: 'choisit sa destination',
    action: 'décide de l\'action du lieu',
    target: 'choisit une cible',
    attack: 'peut attaquer',
  }[g.stage] || '';

  const banner = g.phase === 'over'
    ? (g.winners?.includes(me) ? 'Tu remplis ton objectif — victoire !' : g.winners?.length ? `${g.winners.map((id) => nameById[id] || '?').join(', ')} gagne(nt) !` : 'Personne ne gagne…')
    : g.isMyTurn
      ? `À toi : ${stageHint}`
      : `${nameById[g.turn] || '?'} ${stageHint}…`;

  // Cibles proposées selon le contexte en cours.
  const targetPool = () => {
    if (!g.pending) return [];
    if (g.pending.kind === 'steal') return alive.filter((id) => id !== me && g.players[id].equips.length > 0);
    if (g.pending.kind === 'vision') return alive.filter((id) => id !== me);
    if (g.pending.kind === 'foret-heal') return alive;
    if (g.pending.kind === 'card' || g.pending.kind === 'foret-dmg') return alive.filter((id) => id !== me);
    return alive;
  };

  const myAreaChoices = {
    ermite: [{ c: 'vision', label: '👁️ Piocher une Vision' }],
    porte: [
      { c: 'white', label: '🤍 Carte blanche' },
      { c: 'black', label: '🖤 Carte noire' },
      { c: 'vision', label: '👁️ Carte Vision' },
    ],
    eglise: [{ c: 'white', label: '🤍 Piocher une carte blanche' }],
    cimetiere: [{ c: 'black', label: '🖤 Piocher une carte noire' }],
    foret: [
      { c: 'damage', label: '🌲 Infliger 2 dégâts' },
      { c: 'heal', label: '🌿 Soigner 1 PV' },
    ],
    autel: [{ c: 'steal', label: '🗿 Voler un équipement' }],
  }[myP.area] || [];

  return (
    <div className="pool fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      {/* Ma carte d'identité secrète */}
      {my && (
        <div style={{
          background: '#171a26', color: '#fff', borderRadius: 14, padding: '10px 14px',
          borderLeft: `6px solid ${CAMP_COLORS[my.char.camp]}`, marginBottom: 10, boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 16 }}>{my.char.name}</b>
            <span style={{ color: CAMP_COLORS[my.char.camp], fontWeight: 700 }}>{CAMP_LABEL[my.char.camp]}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 800 }}>❤️ {my.hp}/{my.maxHp}</span>
            {my.revealed && <span style={{ background: '#e0392e', borderRadius: 6, padding: '1px 6px', fontSize: 12 }}>révélée</span>}
            {!my.alive && <span>☠️</span>}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>🎯 {my.win}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>✨ {my.char.ability}</div>
        </div>
      )}

      {/* Plateau : 3 zones de 2 lieux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginBottom: 10 }}>
        {g.zones.map((zone, zi) => (
          <div key={zi} style={{ background: 'rgba(23,26,38,0.88)', borderRadius: 14, padding: 8, color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'center', marginBottom: 4 }}>Zone {zi + 1} — on s'y attaque entre lieux voisins</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {zone.map((aid) => {
                const a = areaById[aid];
                const here = g.seats.filter((id) => g.players[id]?.area === aid && g.players[id]?.alive);
                return (
                  <div key={aid} style={{
                    background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 6, minHeight: 74,
                    outline: myP.area === aid ? '2px solid #f2c11f' : 'none',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{AREA_EMOJI[aid]} {a.name} <span style={{ opacity: 0.6 }}>({a.nums.join('·')})</span></div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4 }}>{a.desc}</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {here.map((id) => (
                        <span key={id} title={nameById[id]} style={{ position: 'relative' }}>
                          <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={22} />
                          {g.turn === id && <span style={{ position: 'absolute', top: -6, right: -4, fontSize: 10 }}>▶</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Joueuses : PV, révélations, équipements */}
      <div className="pool-players" style={{ marginBottom: 10 }}>
        {g.seats.map((id) => {
          const p = g.players[id];
          return (
            <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}
              style={{ opacity: p?.alive ? 1 : 0.45 }}>
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
              <span>{nameById[id] || '?'}</span>
              <b style={{ color: '#e0392e' }}>❤️ {p?.hp ?? '?'}</b>
              {p?.char && <span style={{ color: CAMP_COLORS[p.char.camp], fontWeight: 700, fontSize: 12 }}>{p.char.name}</span>}
              {p?.equips?.map((e, i) => <span key={i} title={e.name} style={{ fontSize: 12 }}>{e.atk ? '⚔️' : '🛡️'}</span>)}
              {!p?.alive && <span>☠️</span>}
            </div>
          );
        })}
      </div>

      {/* Dés & contexte */}
      {(g.dice || g.pending?.text) && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          {g.dice && g.stage !== 'move' && (
            <span style={{ background: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 700, marginRight: 8 }}>
              🎲 {g.dice.d6} + {g.dice.d4} = {g.dice.total}
            </span>
          )}
          {g.pending?.text && g.isMyTurn && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '8px 12px', display: 'inline-block', maxWidth: 420, boxShadow: 'var(--shadow)' }}>
              {g.pending.name ? <b>{g.pending.name} — </b> : null}{g.pending.text}
            </div>
          )}
        </div>
      )}

      {/* Mes actions selon l'étape */}
      {g.phase === 'playing' && g.isMyTurn && my?.alive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          {g.stage === 'move' && (
            <Button variant="contained" size="large" onClick={() => onAction({ kind: 'roll' })}>
              🎲 {my.isEmi ? 'Se déplacer (Emi choisit)' : 'Lancer les dés de déplacement'}
            </Button>
          )}
          {g.stage === 'place' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {g.areas.filter((a) => a.id !== myP.area).map((a) => (
                <Button key={a.id} variant="outlined" size="small" onClick={() => onAction({ kind: 'place', area: a.id })}>
                  {AREA_EMOJI[a.id]} {a.name}
                </Button>
              ))}
            </div>
          )}
          {g.stage === 'action' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {myAreaChoices.map(({ c, label }) => (
                <Button key={c} variant="contained" size="small" onClick={() => onAction({ kind: 'act', choice: c })}>{label}</Button>
              ))}
              <Button variant="outlined" size="small" color="inherit" onClick={() => onAction({ kind: 'act', choice: 'skip' })}>Passer</Button>
            </div>
          )}
          {g.stage === 'target' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {targetPool().map((id) => (
                <Button key={id} variant="contained" size="small" color="secondary" onClick={() => onAction({ kind: 'target', targetId: id })}>
                  {id === me ? 'Moi' : nameById[id] || '?'}
                </Button>
              ))}
            </div>
          )}
          {g.stage === 'attack' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {alive.filter((id) => id !== me && inMyZone(id)).map((id) => (
                <Button key={id} variant="contained" size="small" color="error" startIcon={<Swords size={14} />}
                  onClick={() => onAction({ kind: 'attack', targetId: id })}>
                  {nameById[id] || '?'}
                </Button>
              ))}
              <Button variant="outlined" size="small" color="inherit" onClick={() => onAction({ kind: 'attack' })}>Ne pas attaquer</Button>
            </div>
          )}
          {!my.revealed && ['move', 'action', 'attack'].includes(g.stage) && (
            picker?.kind === 'reveal' ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontSize: 13, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Cible de ta capacité :</span>
                {alive.filter((id) => my.char.id === 'fuka' || id !== me).map((id) => (
                  <Button key={id} variant="contained" size="small" color="warning" onClick={() => onAction({ kind: 'reveal', targetId: id })}>
                    {id === me ? 'Moi' : nameById[id] || '?'}
                  </Button>
                ))}
                <Button size="small" color="inherit" onClick={() => setPicker(null)}>Annuler</Button>
              </div>
            ) : (
              <Button variant="outlined" size="small" startIcon={<Eye size={14} />}
                onClick={() => (my.canOneShot ? setPicker({ kind: 'reveal' }) : onAction({ kind: 'reveal' }))}>
                ⚡ Se révéler {my.canOneShot ? '(et utiliser sa capacité)' : ''}
              </Button>
            )
          )}
        </div>
      )}

      {/* Journal */}
      <div style={{ background: 'rgba(23,26,38,0.85)', color: '#e8e4da', borderRadius: 12, padding: '8px 12px', fontSize: 13, maxHeight: 150, overflowY: 'auto' }}>
        {g.log.slice().reverse().map((l, i) => <div key={i} style={{ padding: '1px 0', opacity: i === 0 ? 1 : 0.75 }}>{l}</div>)}
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}

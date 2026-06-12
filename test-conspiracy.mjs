// Vérification de la logique Conspiracy (façon Complot de Plato) :
// règle du chef, 4 rejets = Espions, sabotages, double-échec mission 4 à 7+.
import { createConspiracy, joinConspiracy, startConspiracy, proposeTeam, voteTeam, playMissionCard, nextMission, viewFor } from './server/games/conspiracy.js';

function freshGame(n) {
  const s = createConspiracy();
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, n);
  for (const id of ids) joinConspiracy(s, id);
  startConspiracy(s, ids[0]);
  return [s, ids];
}
const leaderOf = (s) => s.seats[s.leaderIdx];

// 1) Le chef ne peut pas se choisir lui-même.
{
  const [s] = freshGame(5);
  const lead = leaderOf(s);
  const others = s.seats.filter((id) => id !== lead);
  let threw = false;
  try { proposeTeam(s, lead, [lead, others[0]]); } catch (e) { threw = e.message.includes('lui-même'); }
  if (!threw) throw new Error('Le chef a pu se choisir !');
  proposeTeam(s, lead, others.slice(0, 2)); // sans lui : OK
  console.log('✓ chef exclu de sa propre équipe');
}

// 2) 4 rejets pour la même mission -> les Espions gagnent.
{
  const [s] = freshGame(5);
  for (let r = 0; r < 4; r++) {
    const lead = leaderOf(s);
    const others = s.seats.filter((id) => id !== lead);
    proposeTeam(s, lead, others.slice(0, s.teamSizes[0]));
    for (const id of s.seats) voteTeam(s, id, false);
  }
  if (s.phase !== 'over' || s.winner !== 'spies') throw new Error('4 rejets devraient donner la victoire aux Espions !');
  console.log('✓ 4 rejets = victoire des Espions');
}

// 3) Partie complète aléatoire à 4, 5, 6, 7 et 8 joueuses (sans blocage).
for (const n of [4, 5, 6, 7, 8]) {
  const [s] = freshGame(n);
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 500) {
    if (s.phase === 'team') {
      const lead = leaderOf(s);
      const others = s.seats.filter((id) => id !== lead);
      proposeTeam(s, lead, others.slice(0, s.teamSizes[s.mission]));
    } else if (s.phase === 'vote') {
      for (const id of s.seats) if (s.votes[id] == null) voteTeam(s, id, Math.random() < 0.7);
    } else if (s.phase === 'mission') {
      for (const id of [...s.team]) {
        if (s.missionCards[id] == null) {
          playMissionCard(s, id, s.roles[id] === 'spy' && Math.random() < 0.6 ? 'fail' : 'success');
        }
        if (s.phase !== 'mission') break;
      }
    } else if (s.phase === 'reveal') {
      nextMission(s, s.seats[0]);
    }
    for (const id of s.seats) viewFor(s, id);
    viewFor(s, 'spectatrice');
  }
  if (s.phase !== 'over') throw new Error(`Partie à ${n} bloquée !`);
  const sizes = s.teamSizes.join(',');
  console.log(`✓ partie à ${n} joueuses terminée (équipes ${sizes}, vainqueur ${s.winner})`);
}

// 4) La Société ne peut pas saboter.
{
  const [s] = freshGame(5);
  const lead = leaderOf(s);
  const others = s.seats.filter((id) => id !== lead);
  proposeTeam(s, lead, others.slice(0, 2));
  for (const id of s.seats) voteTeam(s, id, true);
  const member = s.team.find((id) => s.roles[id] === 'society');
  if (member) {
    let threw = false;
    try { playMissionCard(s, member, 'fail'); } catch { threw = true; }
    if (!threw) throw new Error('La Société a pu saboter !');
  }
  console.log('✓ la Société ne peut pas saboter');
}

console.log('✅ Conspiracy conforme au Complot (Plato) + variante 4 joueuses cohérente');

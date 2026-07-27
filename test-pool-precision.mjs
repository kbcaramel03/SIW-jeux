// Précision de la visée : la flèche prédit que la bille touchée part le long
// de la ligne des centres (modèle de la bille fantôme). On vérifie que la
// simulation suit cette prédiction à moins de 2° près, pour plusieurs angles
// de coupe et puissances — et qu'un coup visé vers une poche empoche vraiment.
import { simulate, TABLE, POCKETS } from './server/games/pool.js';

const R = TABLE.R;
let worst = 0;
for (const cut of [0, 10, 20, 30, 40, 50, 60]) {          // angle de coupe (°)
  for (const power of [0.3, 0.6, 1]) {
    // Bille objet au centre ; on veut l'envoyer plein est (angle 0).
    const ob = { id: 1, x: 1.2, y: 0.5, vx: 0, vy: 0, pocketed: false };
    // Point fantôme : derrière la bille objet, à l'opposé de la direction voulue.
    const gx = ob.x - 2 * R, gy = ob.y;
    // La blanche arrive sur le point fantôme depuis un angle de coupe donné.
    const a = (cut * Math.PI) / 180;
    const cue = { id: 0, x: gx - 0.5 * Math.cos(a), y: gy + 0.5 * Math.sin(a), vx: 0, vy: 0, pocketed: false };
    const balls = [cue, ob];
    // Trace la direction de la bille objet juste après le choc.
    let dir = null;
    simulate(balls, { dx: gx - cue.x, dy: gy - cue.y, power }, () => {
      if (dir === null && Math.hypot(ob.vx, ob.vy) > 0.001) dir = Math.atan2(ob.vy, ob.vx);
    });
    if (dir === null) throw new Error(`coupe ${cut}° puissance ${power} : la bille n'a pas été touchée`);
    const err = Math.abs((dir * 180) / Math.PI);
    worst = Math.max(worst, err);
    if (err > 2) throw new Error(`coupe ${cut}° puissance ${power} : déviation ${err.toFixed(2)}° (> 2°)`);
  }
}
console.log(`✓ bille fantôme fidèle : déviation max ${worst.toFixed(2)}° sur coupes 0-60° à toutes puissances`);

// Empochages réels : bille alignée sur chaque poche depuis plusieurs positions
// de blanche -> le tir « ligne des centres » doit rentrer.
let ok = 0, total = 0;
for (const [px, py] of POCKETS) {
  for (const from of [[0.4, 0.5], [1.0, 0.3], [1.4, 0.7]]) {
    const toward = Math.atan2(py - 0.5, px - 1.0);
    const ob = { id: 1, x: 1.0, y: 0.5, vx: 0, vy: 0, pocketed: false };
    const gx = ob.x - 2 * R * Math.cos(toward), gy = ob.y - 2 * R * Math.sin(toward);
    const cue = { id: 0, x: from[0], y: from[1], vx: 0, vy: 0, pocketed: false };
    // Coupe impossible (blanche devant la ligne) : on saute ce cas.
    const dot = (gx - cue.x) * Math.cos(toward) + (gy - cue.y) * Math.sin(toward);
    if (dot <= 0.05) continue;
    total++;
    const potted = simulate([cue, ob], { dx: gx - cue.x, dy: gy - cue.y, power: 0.8 });
    if (potted.includes(1) && !potted.includes(0)) ok++;
  }
}
if (ok / total < 0.85) throw new Error(`Seulement ${ok}/${total} empochages alignés réussis`);
console.log(`✓ ${ok}/${total} empochages alignés réussis`);

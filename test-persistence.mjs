// Test de bout en bout : un salon créé survit-il à un redémarrage du serveur ?
// 1) login -> socket -> création d'un salon Loup Garou
// 2) arrêt « propre » du serveur (SIGTERM impossible sous Windows -> on attend la
//    sauvegarde périodique de ~10 s), redémarrage
// 3) reconnexion -> le salon doit être dans la liste du lobby
import { io } from './client/node_modules/socket.io-client/build/esm/index.js';
import { spawn } from 'child_process';

const BASE = 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const p = spawn(process.execPath, ['server/index.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write('[srv] ' + d));
  p.stderr.on('data', (d) => process.stdout.write('[srv!] ' + d));
  return p;
}

async function login() {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'khadija', password: 'admin1234' }),
  });
  const j = await res.json();
  if (!j.token) throw new Error('login failed: ' + JSON.stringify(j));
  return j.token;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

let server = startServer();
await wait(2500);

const token = await login();
let sock = await connect(token);

// Crée un salon Loup Garou
const { roomId } = await new Promise((r) => sock.emit('room:create', { gameKey: 'loupgarou', name: 'Test persistance' }, r));
console.log('Salon créé :', roomId);
await new Promise((r) => sock.emit('room:join', { roomId }, r));

// Attend la sauvegarde périodique (~10 s) puis tue le serveur (simule un restart Render)
console.log('Attente de la sauvegarde périodique (12 s)…');
await wait(12000);
sock.disconnect();
server.kill('SIGKILL');
await wait(1500);

console.log('Redémarrage du serveur…');
server = startServer();
await wait(3000);

sock = await connect(token);
const rooms = await new Promise((r) => {
  sock.once('lobby:rooms', r);
  sock.emit('lobby:refresh');
});
const found = rooms.find((x) => x.id === roomId);
console.log(found ? `✅ SALON RESTAURÉ après redémarrage : ${found.name} (${found.id})` : '❌ ÉCHEC : salon perdu. Liste: ' + JSON.stringify(rooms));

// On peut même le rejoindre et retrouver la partie
const joinRes = await new Promise((r) => sock.emit('room:join', { roomId }, r));
console.log(joinRes?.ok ? '✅ Rejoint le salon restauré sans erreur' : '❌ room:join: ' + JSON.stringify(joinRes));

sock.disconnect();
server.kill('SIGKILL');
process.exit(found && joinRes?.ok ? 0 : 1);

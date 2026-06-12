// Point d'entrée du serveur : API REST (comptes/admin) + temps réel (Socket.IO).
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

import { PORT, DEV_ORIGINS, IS_PROD } from './config.js';
import db from './db.js';
import { ensureSeed } from './seedData.js';
import { synthesize } from './tts.js';
import { router as authRouter } from './auth.js';
import { router as adminRouter } from './admin.js';
import { createRealtime } from './realtime.js';

// Crée les 5 comptes de départ si la base est encore vide (utile au 1er déploiement).
await ensureSeed(db, { log: (m) => console.log(m) });

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

if (!IS_PROD) app.use(cors({ origin: DEV_ORIGINS, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Synthèse vocale « maître du jeu » : voix neurales françaises (Microsoft
// Edge TTS, gratuites et sans clé). La voix, le débit et la hauteur sont
// paramétrables (liste blanche + bornes pour éviter les abus).
const TTS_VOICES = new Set([
  'fr-FR-RemyMultilingualNeural',     // français, dernière génération
  'fr-FR-HenriNeural',                // français classique
  'fr-FR-VivienneMultilingualNeural', // française, dernière génération
  'en-US-AndrewMultilingualNeural',   // multilingue, très grave (parle français)
  'en-US-BrianMultilingualNeural',    // multilingue, posé (parle français)
]);
const clampPct = (v, def) => {
  const n = Number(String(v || '').replace('%', ''));
  if (!Number.isFinite(n)) return def;
  return `${Math.max(-40, Math.min(20, Math.round(n)))}%`;
};
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 400);
  const voice = TTS_VOICES.has(String(req.query.voice)) ? String(req.query.voice) : 'fr-FR-RemyMultilingualNeural';
  const rate = clampPct(req.query.rate, '-12%');
  const pitch = clampPct(req.query.pitch, '-12%');
  if (!text) return res.status(400).end();
  try {
    const audio = await synthesize(text, voice, rate, pitch);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(audio);
  } catch (e) {
    console.error('TTS :', e.message);
    res.status(502).end();
  }
});

// En production, on sert le site React compilé (client/dist).
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  // Les fichiers de /assets ont un nom unique par version (hash Vite) : on peut
  // les mettre en cache un an, les téléphones ne les retéléchargent plus.
  app.use('/assets', express.static(join(clientDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);
createRealtime(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\n🎮  Soirée Jeux — serveur lancé sur http://localhost:${PORT}`);
  if (!IS_PROD) console.log('   (en dev, ouvre le client Vite : http://localhost:5173)\n');
});

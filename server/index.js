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

// Synthèse vocale « maître du jeu » : proxy vers une voix française naturelle
// (Google Translate TTS, gratuit et sans clé). Renvoie un MP3.
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 200);
  if (!text) return res.status(400).end();
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' } });
    if (!r.ok) return res.status(502).end();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

// En production, on sert le site React compilé (client/dist).
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
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

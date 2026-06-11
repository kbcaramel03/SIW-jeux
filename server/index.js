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
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
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

// Synthèse vocale « maître du jeu » : voix neural masculine française (Microsoft
// Edge TTS, gratuite et sans clé), débit lent + grave pour un ton de vieux sage.
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 400);
  const voice = String(req.query.voice || 'fr-FR-HenriNeural');
  if (!text) return res.status(400).end();
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate: '-12%', pitch: '-12%' });
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    let sent = false;
    audioStream.on('data', (d) => { sent = true; res.write(d); });
    audioStream.on('end', () => res.end());
    audioStream.on('close', () => res.end());
    audioStream.on('error', () => { if (!sent) res.status(502).end(); else res.end(); });
  } catch {
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

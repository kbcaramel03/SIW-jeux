// Mini-client Edge TTS (voix neurales Microsoft, gratuites, sans clé).
// Les paquets npm existants sont cassés depuis que Microsoft exige un jeton
// Sec-MS-GEC : on le calcule nous-mêmes (SHA-256 de l'horodatage Windows
// arrondi à 5 min + jeton client public), comme le fait le navigateur Edge.
import { createHash, randomUUID, randomBytes } from 'crypto';
import WebSocket from 'ws';

const TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
// Version d'Edge déclarée : doit rester à peu près à jour (sinon 403).
const EDGE_VERSION = '143.0.3650.75';
const MAJOR = EDGE_VERSION.split('.')[0];
const UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MAJOR}.0.0.0 Safari/537.36 Edg/${MAJOR}.0.0.0`;

// Correction du décalage d'horloge : le jeton Sec-MS-GEC est basé sur l'heure
// (fenêtre de 5 min). Si l'horloge de la machine est fausse, Microsoft répond
// 403. On se cale donc sur l'heure du serveur (en-tête Date), rafraîchie
// toutes les heures — c'est ce que fait l'edge-tts officiel.
let clockSkewMs = 0;
let skewSyncedAt = 0;
async function syncClock() {
  if (Date.now() - skewSyncedAt < 3600000) return;
  try {
    const res = await fetch('https://speech.platform.bing.com/', { method: 'HEAD' }).catch(() => fetch('https://speech.platform.bing.com/'));
    const date = res?.headers?.get('date');
    if (date) {
      clockSkewMs = new Date(date).getTime() - Date.now();
      skewSyncedAt = Date.now();
    }
  } catch { /* on réessaiera au prochain appel */ }
}

function gecToken() {
  const sec = Math.floor((Date.now() + clockSkewMs) / 1000);
  const ticks = (sec - (sec % 300) + 11644473600) * 10000000;
  return createHash('sha256').update(`${ticks}${TRUSTED_TOKEN}`).digest('hex').toUpperCase();
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Petit cache mémoire : les phrases du maître du jeu reviennent souvent.
const cache = new Map(); // clé -> Buffer mp3
const CACHE_MAX = 150;

export async function synthesize(text, voice, rate = '-12%', pitch = '-12%') {
  const key = `${voice}|${rate}|${pitch}|${text}`;
  if (cache.has(key)) return cache.get(key);
  await syncClock();

  return new Promise((resolve, reject) => {
    const reqId = randomUUID().replaceAll('-', '');
    const url = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
      + `?TrustedClientToken=${TRUSTED_TOKEN}&ConnectionId=${reqId}&Sec-MS-GEC=${gecToken()}&Sec-MS-GEC-Version=1-${EDGE_VERSION}`;
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': UA,
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        // Le service exige désormais un identifiant de session aléatoire.
        'Cookie': `muid=${randomBytes(16).toString('hex').toUpperCase()};`,
      },
    });
    const chunks = [];
    let done = false;
    const finish = (err, buf) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* déjà fermée */ }
      if (err) reject(err); else resolve(buf);
    };
    const timer = setTimeout(() => { try { ws.terminate(); } catch { /* rien */ } finish(new Error('TTS : délai dépassé')); }, 15000);

    ws.on('open', () => {
      const ts = new Date().toString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
        + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'>`
        + `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const headerLen = data.readUInt16BE(0);
        const header = data.subarray(2, 2 + headerLen).toString();
        if (header.includes('Path:audio')) chunks.push(data.subarray(2 + headerLen));
      } else if (data.toString().includes('Path:turn.end')) {
        const buf = Buffer.concat(chunks);
        if (buf.length === 0) return finish(new Error('TTS : audio vide'));
        cache.set(key, buf);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        finish(null, buf);
      }
    });
    ws.on('error', (e) => finish(e));
    ws.on('close', () => finish(new Error('TTS : connexion fermée')));
  });
}

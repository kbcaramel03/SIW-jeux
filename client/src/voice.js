// Narration vocale « maître du jeu » via la Web Speech API (native, gratuite).
// Voix française, pitch bas et débit lent pour un effet de vieux mage mystique.
let frVoice = null;
let chosenName = (typeof localStorage !== 'undefined' && localStorage.getItem('sj_voice')) || null;

function pickVoice() {
  const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!s) return;
  const voices = s.getVoices() || [];
  if (chosenName) { const v = voices.find((x) => x.name === chosenName); if (v) { frVoice = v; return; } }
  const fr = voices.filter((v) => /^fr/i.test(v.lang));
  // On privilégie les voix les plus naturelles disponibles (Google, neural/enhanced).
  frVoice = fr.find((v) => /google/i.test(v.name))
    || fr.find((v) => /(natural|neural|enhanced|premium|siri)/i.test(v.name))
    || fr.find((v) => /(audrey|aurélie|aurelie|julie|marie|léa|lea|thomas|paul)/i.test(v.name))
    || fr[0]
    || voices.find((v) => /google/i.test(v.name))
    || voices[0] || null;
}

// Voix françaises disponibles (pour le sélecteur).
export function listVoices() {
  const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!s) return [];
  return (s.getVoices() || []).filter((v) => /^fr/i.test(v.lang));
}
export function getChosenVoice() { return chosenName; }
export function setVoiceByName(name) {
  chosenName = name || null;
  try { localStorage.setItem('sj_voice', chosenName || ''); } catch { /* ignore */ }
  pickVoice();
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function voiceSupported() { return typeof window !== 'undefined' && !!window.speechSynthesis; }

// --- Déblocage de l'autoplay ---
// Les navigateurs bloquent la lecture audio tant que l'utilisateur n'a pas interagi
// avec la page. Comme la narration part d'un minuteur (pas d'un clic direct), on
// « débloque » le son au premier geste : on joue un court silence + on amorce la
// synthèse vocale. Ensuite, les appels à speak() passent sans souci.
let primed = false;
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
function primeAudio() {
  if (primed) return;
  primed = true;
  try { const a = new Audio(SILENCE); a.volume = 0; a.play().catch(() => {}); } catch { /* ignore */ }
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis?.speak(u); } catch { /* ignore */ }
}
export function audioPrimed() { return primed; }
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, primeAudio, { capture: true, passive: true });
  }
}

let audio = null;

// Voix navigateur (repli si l'audio cloud échoue).
function speakLocal(text) {
  try {
    const s = window.speechSynthesis;
    if (!s || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (frVoice) u.voice = frVoice;
    u.lang = 'fr-FR';
    u.pitch = 0.95;
    u.rate = 0.9;
    u.volume = 1;
    s.speak(u);
  } catch { /* ignore */ }
}

// Corrige la PRONONCIATION de certains prénoms pour la voix (le texte affiché, lui,
// reste correct). « Khadija » : le « kh » se dit comme un r sec / jota espagnole.
const PRONOUNCE = [
  [/\bKhadija\b/gi, 'Rhadija'],
];
function phonetic(text) {
  let t = String(text || '');
  for (const [re, rep] of PRONOUNCE) t = t.replace(re, rep);
  return t;
}

// Voix du maître du jeu : Andrew (neurale multilingue, grave et profonde),
// ralentie et abaissée pour un ton de vieux mage. Même voix pour tout le monde.
const NARRATOR = { voice: 'en-US-AndrewMultilingualNeural', rate: -14, pitch: -10 };

// Voix naturelle (Edge neural via notre proxy /api/tts), repli local si erreur.
export function speak(text) {
  if (!text) return;
  stopSpeak();
  const spoken = phonetic(text);
  try {
    audio = new Audio(`/api/tts?voice=${encodeURIComponent(NARRATOR.voice)}&rate=${NARRATOR.rate}&pitch=${NARRATOR.pitch}&text=${encodeURIComponent(spoken)}`);
    audio.play().catch(() => speakLocal(spoken));
    audio.onerror = () => speakLocal(spoken);
  } catch {
    speakLocal(spoken);
  }
}

export function stopSpeak() {
  try { if (audio) { audio.pause(); audio = null; } } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

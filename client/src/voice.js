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

// Voix naturelle (AWS Polly français via notre proxy /api/tts), repli local si erreur.
export function speak(text) {
  if (!text) return;
  stopSpeak();
  try {
    audio = new Audio(`/api/tts?v=henri1&text=${encodeURIComponent(text)}`); // v= casse le cache si la voix change
    audio.play().catch(() => speakLocal(text));
    audio.onerror = () => speakLocal(text);
  } catch {
    speakLocal(text);
  }
}

export function stopSpeak() {
  try { if (audio) { audio.pause(); audio = null; } } catch { /* ignore */ }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

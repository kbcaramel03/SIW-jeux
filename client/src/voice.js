// Narration vocale « maître du jeu » via la Web Speech API (native, gratuite).
// Voix française, pitch bas et débit lent pour un effet de vieux mage mystique.
let frVoice = null;

function pickVoice() {
  const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!s) return;
  const voices = s.getVoices() || [];
  const fr = voices.filter((v) => /^fr/i.test(v.lang));
  // On privilégie les voix les plus naturelles disponibles (Google, neural/enhanced).
  frVoice = fr.find((v) => /google/i.test(v.name))
    || fr.find((v) => /(natural|neural|enhanced|premium|siri)/i.test(v.name))
    || fr.find((v) => /(audrey|aurélie|aurelie|julie|marie|léa|lea|thomas|paul)/i.test(v.name))
    || fr[0]
    || voices.find((v) => /google/i.test(v.name))
    || voices[0] || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function voiceSupported() { return typeof window !== 'undefined' && !!window.speechSynthesis; }

export function speak(text) {
  try {
    const s = window.speechSynthesis;
    if (!s || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (frVoice) u.voice = frVoice;
    u.lang = 'fr-FR';
    u.pitch = 0.95; // proche du naturel (un pitch trop bas sonne robotique)
    u.rate = 0.9;   // légèrement lent pour le côté solennel, sans déformer la voix
    u.volume = 1;
    s.speak(u);
  } catch { /* ignore */ }
}

export function stopSpeak() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

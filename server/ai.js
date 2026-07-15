// Pont vers l'API OpenAI (clé dans OPENAI_API_KEY, réglée sur Render).
// Tout est optionnel : sans clé, chaque jeu retombe sur son comportement
// classique (votes seuls au Petit Bac, voix Edge au Loup Garou, etc.).
// Aucune dépendance : fetch natif de Node 20.

const KEY = () => process.env.OPENAI_API_KEY || '';
// GPT-5.6 (sorti le 9 juillet 2026) : trois niveaux — sol (haut de gamme),
// terra (équilibre), luna (rapide et pas cher). Terra suffit largement ici.
const MODEL = () => process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const TTS_MODEL = () => process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = () => process.env.OPENAI_TTS_VOICE || 'sage';

export const aiAvailable = () => !!KEY();

// Si le modèle demandé n'existe pas (identifiant qui change, accès restreint…),
// on essaie les suivants au lieu d'échouer en silence — et on mémorise celui
// qui marche pour les appels suivants.
const FALLBACK_MODELS = ['gpt-5.6-luna', 'gpt-5.1-mini', 'gpt-4o-mini'];
let workingModel = null;

// Appel « chat » avec réponse JSON garantie. Renvoie l'objet parsé, ou null
// en cas de pépin (panne, quota, JSON invalide) — jamais d'exception.
export async function chatJSON(system, user, { timeoutMs = 12000 } = {}) {
  if (!aiAvailable()) return null;
  const first = workingModel || MODEL();
  const models = [first, ...FALLBACK_MODELS.filter((m) => m !== first)];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (const model of models) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) },
          ],
        }),
      });
      if (res.ok) {
        if (workingModel !== model) { workingModel = model; console.log('OpenAI : modèle utilisé →', model); }
        const data = await res.json();
        return JSON.parse(data.choices?.[0]?.message?.content || 'null');
      }
      const detail = (await res.text()).slice(0, 200);
      console.error('OpenAI chat :', model, res.status, detail);
      // 400/404 = modèle inconnu ou paramètre refusé -> on tente le suivant.
      // 401/429/5xx = clé, quota ou panne -> inutile d'insister.
      if (res.status !== 400 && res.status !== 404) return null;
    }
    return null;
  } catch (e) {
    console.error('OpenAI chat :', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Synthèse vocale (voix du Loup Garou) -----------------------------------
const speechCache = new Map(); // texte -> Buffer mp3
const SPEECH_CACHE_MAX = 150;

export async function speech(text) {
  if (!aiAvailable()) return null;
  const key = `${TTS_VOICE()}|${text}`;
  if (speechCache.has(key)) return speechCache.get(key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
      body: JSON.stringify({
        model: TTS_MODEL(),
        voice: TTS_VOICE(),
        input: text,
        instructions: 'Parle en français. Voix de conteuse mystérieuse de jeu du Loup-Garou : grave, lente, théâtrale, un peu inquiétante.',
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      console.error('OpenAI TTS :', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    speechCache.set(key, buf);
    if (speechCache.size > SPEECH_CACHE_MAX) speechCache.delete(speechCache.keys().next().value);
    return buf;
  } catch (e) {
    console.error('OpenAI TTS :', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- ChatGPT joue : choix d'un coup parmi une liste d'options ----------------
// On lui donne les règles, la situation et des options numérotées lisibles ;
// il répond par l'index. Toujours validé, jamais bloquant.
export async function chooseMove(gameLabel, rules, situation, options) {
  const out = await chatJSON(
    `Tu joues à ${gameLabel} contre des joueuses humaines. ${rules} `
    + 'Comporte-toi comme une VRAIE joueuse humaine : ni trop forte, ni trop faible. '
    + 'Joue bien la plupart du temps, mais reste naturelle et imprévisible — tu as le droit d\'être sans pitié '
    + '(capturer, attaquer, bloquer) comme de laisser passer une occasion, selon ton humeur. '
    + 'Ne cherche pas le coup parfait à chaque fois. Réponds UNIQUEMENT en JSON : {"choix": <numéro de l\'option>}.',
    { situation, options: options.map((o, i) => `${i}. ${o}`) },
    { timeoutMs: 6500 }, // un coup de jeu doit tomber vite : au-delà, l'heuristique locale joue
  );
  const i = Math.round(Number(out?.choix));
  return Number.isInteger(i) && i >= 0 && i < options.length ? i : null;
}

// Décision asynchrone rangée dans state.aiTask (les moteurs sont synchrones :
// on pose la question à un tick, on applique la réponse à un tick suivant).
// Renvoie 'wait' (réponse en route), null (pas d'IA / échec -> heuristique
// locale), ou l'élément de `moves` choisi par ChatGPT.
export function aiTurn(state, build) {
  const t = state.aiTask;
  if (t?.status === 'pending') {
    if (Date.now() - (t.t0 || 0) > 8000) { state.aiTask = null; return null; } // panne/redémarrage
    return 'wait';
  }
  if (t?.status === 'done') {
    state.aiTask = null;
    const i = t.result;
    return Number.isInteger(i) && t.moves && t.moves[i] !== undefined ? t.moves[i] : null;
  }
  if (!aiAvailable()) return null;
  const built = build();
  if (!built || !built.options || built.options.length === 0) return null;
  if (built.options.length === 1) return built.moves[0]; // pas de dilemme : on économise l'appel
  const task = { status: 'pending', t0: Date.now(), moves: built.moves };
  state.aiTask = task;
  chooseMove(built.label, built.rules, built.situation, built.options)
    .then((i) => { task.status = 'done'; task.result = i; })
    .catch(() => { task.status = 'done'; task.result = null; });
  return 'wait';
}

// --- Arbitre du Petit Bac ----------------------------------------------------
// items: [{ id, category, word }] pour une lettre donnée.
// Renvoie { id: true|false } ou null si l'IA est indisponible.
export async function petitbacJudge(letter, items) {
  const out = await chatJSON(
    'Tu es l\'arbitre bienveillant d\'un jeu de Petit Bac (baccalauréat) entre amies francophones. '
    + `Pour chaque mot proposé, dis s'il est acceptable : il doit commencer par la lettre « ${letter} » (accents et majuscules ignorés : É compte pour E) `
    + 'ET correspondre vraiment à sa catégorie. Sois tolérant sur les petites fautes d\'orthographe et accepte les noms propres connus, '
    + 'les marques et le langage courant. Refuse les mots inventés, hors catégorie ou qui ne commencent pas par la lettre. '
    + 'Réponds UNIQUEMENT en JSON : {"verdicts": {"<id>": true|false, ...}}.',
    { lettre: letter, mots: items },
  );
  const verdicts = out?.verdicts;
  if (!verdicts || typeof verdicts !== 'object') return null;
  const clean = {};
  for (const { id } of items) if (typeof verdicts[id] === 'boolean') clean[id] = verdicts[id];
  return clean;
}

// --- Maître-espionne IA de Codenames (mode Duo) ------------------------------
// words: [{ word, kind }] non révélés, kind ∈ agent|bystander|assassin (sa clé).
// Renvoie { clue, count } ou null.
export async function codenamesClue(words) {
  const agents = words.filter((w) => w.kind === 'agent').map((w) => w.word);
  const assassins = words.filter((w) => w.kind === 'assassin').map((w) => w.word);
  const others = words.filter((w) => w.kind === 'bystander').map((w) => w.word);
  const out = await chatJSON(
    'Tu joues au Codenames Duo en français, côté maître-espionne. Donne UN indice (un seul mot français, jamais un mot du plateau '
    + 'ni un dérivé direct) et un nombre = combien de mots AGENTS il relie. Choisis un indice qui relie 2 ou 3 agents si possible, '
    + 'en évitant ABSOLUMENT toute association avec les mots assassins, et en limitant les liens avec les mots neutres. '
    + 'Réponds UNIQUEMENT en JSON : {"clue": "MOT", "count": 2, "targets": ["AGENT1", "AGENT2"]}.',
    { agents, assassins, neutres: others },
  );
  const clue = String(out?.clue || '').trim().toUpperCase();
  const count = Math.max(1, Math.min(4, Math.round(Number(out?.count) || 1)));
  if (!clue || /\s/.test(clue)) return null;
  // Jamais un mot du plateau (ni son début) : la règle d'or de Codenames.
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  for (const w of words) {
    const a = norm(w.word), b = norm(clue);
    if (a === b || a.startsWith(b) || b.startsWith(a)) return null;
  }
  return { clue, count };
}

// L'IA devine : à partir d'un indice, classe les mots du plateau.
// Renvoie une liste ordonnée de mots (les plus probables d'abord) ou null.
export async function codenamesGuess(clueWord, count, words) {
  const out = await chatJSON(
    'Tu joues au Codenames Duo en français, côté devineuse. On te donne un indice (mot + nombre) et la liste des mots non révélés '
    + `du plateau. Choisis les ${count} mot(s) du plateau les plus liés à l'indice, du plus sûr au moins sûr. Ne choisis que des mots `
    + 'dont tu es raisonnablement sûre. Réponds UNIQUEMENT en JSON : {"guesses": ["MOT1", "MOT2"]}.',
    { indice: clueWord, nombre: count, plateau: words },
  );
  const list = Array.isArray(out?.guesses) ? out.guesses.map((w) => String(w).toUpperCase().trim()) : null;
  if (!list) return null;
  const onBoard = list.filter((w) => words.includes(w));
  return onBoard.length ? onBoard.slice(0, count) : null;
}

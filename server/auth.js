// Authentification : inscription, connexion, et middleware de vérification du jeton.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import db, { publicUser } from './db.js';
import { JWT_SECRET, TOKEN_TTL } from './config.js';

export const router = Router();

// Normalise un identifiant : minuscules, sans espaces superflus.
function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// --- Inscription : crée un compte "en attente" que l'admin devra valider ---
router.post('/register', async (req, res) => {
  const username = normalize(req.body.username);
  const displayName = String(req.body.displayName || '').trim() || req.body.username;
  const password = String(req.body.password || '');
  const gender = ['F', 'M', 'A'].includes(req.body.gender) ? req.body.gender : null;

  if (username.length < 3) return res.status(400).json({ error: "Ton identifiant doit faire au moins 3 caractères." });
  if (password.length < 4) return res.status(400).json({ error: 'Ton mot de passe doit faire au moins 4 caractères.' });
  if (!gender) return res.status(400).json({ error: 'Choisis si tu es une fille, un mec, ou autre.' });

  await db.read();
  if (db.data.users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'Cet identifiant est déjà pris.' });
  }

  const user = {
    id: nanoid(10),
    username,
    displayName,
    gender, // 'F' | 'M' | 'A'
    passwordHash: await bcrypt.hash(password, 10),
    role: 'member',
    status: 'pending', // en attente de validation par l'admin
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  await db.write();

  res.status(201).json({ ok: true, message: 'Inscription envoyée ! En attente de validation par Khadija.' });
});

// --- Connexion ---
router.post('/login', async (req, res) => {
  const username = normalize(req.body.username);
  const password = String(req.body.password || '');

  await db.read();
  const user = db.data.users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Ton compte est encore en attente de validation par Khadija.' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Ton inscription a été refusée.' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// --- Infos sur l'utilisateur connecté ---
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// --- Changer son mot de passe ---
router.post('/change-password', requireAuth, async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (next.length < 4) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 4 caractères.' });
  if (!(await bcrypt.compare(current, req.user.passwordHash))) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }
  req.user.passwordHash = await bcrypt.hash(next, 10);
  await db.write();
  res.json({ ok: true });
});

// --- Middleware : vérifie le jeton et attache l'utilisateur à la requête ---
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    await db.read();
    const user = db.data.users.find((u) => u.id === id);
    if (!user || user.status !== 'approved') return res.status(401).json({ error: 'Session invalide.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
  }
}

// Vérifie un jeton et renvoie l'utilisateur (utilisé aussi par Socket.IO).
export async function userFromToken(token) {
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    await db.read();
    const user = db.data.users.find((u) => u.id === id);
    if (!user || user.status !== 'approved') return null;
    return user;
  } catch {
    return null;
  }
}

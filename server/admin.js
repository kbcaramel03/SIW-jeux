// Routes réservées à l'admin (Khadija) : valider les inscriptions, gérer les membres.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { publicUser } from './db.js';
import { requireAuth } from './auth.js';

export const router = Router();

// Fondatrice : compte protégé. Personne ne peut lui retirer le rôle admin,
// la supprimer, ni modifier son compte (sauf elle-même).
const FOUNDER_USERNAME = 'khadija';
const isFounder = (u) => u.username === FOUNDER_USERNAME;

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'admin.' });
  next();
}

router.use(requireAuth, requireAdmin);

// Renvoie l'utilisateur public enrichi (marqueur fondatrice).
const adminView = (u) => ({ ...publicUser(u), founder: isFounder(u) });

// Liste de tous les comptes (en attente d'abord) + petites statistiques.
router.get('/users', async (req, res) => {
  await db.read();
  const order = { pending: 0, approved: 1, rejected: 2 };
  const users = [...db.data.users]
    .sort((a, b) => (order[a.status] - order[b.status]) || a.createdAt.localeCompare(b.createdAt))
    .map(adminView);
  const stats = {
    total: users.length,
    pending: users.filter((u) => u.status === 'pending').length,
    approved: users.filter((u) => u.status === 'approved').length,
    rejected: users.filter((u) => u.status === 'rejected').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };
  res.json({ users, stats });
});

function findUser(req, res) {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return null;
  }
  return user;
}

// Empêche toute action d'un autre admin sur la fondatrice.
function guardFounder(user, req, res) {
  if (isFounder(user) && user.id !== req.user.id) {
    res.status(403).json({ error: 'Khadija est la fondatrice : son compte est protégé.' });
    return false;
  }
  return true;
}

router.post('/users/:id/approve', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  user.status = 'approved';
  await db.write();
  res.json({ user: adminView(user) });
});

router.post('/users/:id/reject', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (user.role === 'admin') return res.status(400).json({ error: 'On ne refuse pas un admin.' });
  user.status = 'rejected';
  await db.write();
  res.json({ user: adminView(user) });
});

// Promouvoir / rétrograder admin.
router.post('/users/:id/role', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  const role = req.body.role === 'admin' ? 'admin' : 'member';
  if (isFounder(user) && role !== 'admin') {
    return res.status(400).json({ error: 'Khadija est la fondatrice : son rôle admin ne peut pas être retiré.' });
  }
  if (user.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Tu ne peux pas retirer ton propre rôle admin.' });
  }
  user.role = role;
  await db.write();
  res.json({ user: adminView(user) });
});

// Réinitialiser le mot de passe d'un membre (mot de passe temporaire fixé par l'admin).
router.post('/users/:id/password', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (!guardFounder(user, req, res)) return;
  const password = String(req.body.password || '');
  if (password.length < 4) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères.' });
  user.passwordHash = await bcrypt.hash(password, 10);
  await db.write();
  res.json({ ok: true });
});

// Modifier le profil d'un membre (nom affiché / genre).
router.post('/users/:id/profile', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (!guardFounder(user, req, res)) return;
  if (req.body.displayName != null) {
    const name = String(req.body.displayName).trim();
    if (name.length < 2) return res.status(400).json({ error: 'Le nom doit faire au moins 2 caractères.' });
    user.displayName = name.slice(0, 30);
  }
  if (req.body.gender != null && ['F', 'M', 'A'].includes(req.body.gender)) {
    user.gender = req.body.gender;
  }
  await db.write();
  res.json({ user: adminView(user) });
});

router.delete('/users/:id', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (isFounder(user)) return res.status(400).json({ error: 'Khadija est la fondatrice : son compte ne peut pas être supprimé.' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas te supprimer toi-même.' });
  db.data.users = db.data.users.filter((u) => u.id !== user.id);
  await db.write();
  res.json({ ok: true });
});

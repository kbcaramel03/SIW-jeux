// Routes réservées à l'admin (Khadija) : valider les inscriptions, gérer les membres.
import { Router } from 'express';
import db, { publicUser } from './db.js';
import { requireAuth } from './auth.js';

export const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé à l\'admin.' });
  next();
}

router.use(requireAuth, requireAdmin);

// Liste de tous les comptes (en attente d'abord).
router.get('/users', async (req, res) => {
  await db.read();
  const order = { pending: 0, approved: 1, rejected: 2 };
  const users = [...db.data.users]
    .sort((a, b) => (order[a.status] - order[b.status]) || a.createdAt.localeCompare(b.createdAt))
    .map(publicUser);
  res.json({ users });
});

function findUser(req, res) {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisatrice introuvable.' });
    return null;
  }
  return user;
}

router.post('/users/:id/approve', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  user.status = 'approved';
  await db.write();
  res.json({ user: publicUser(user) });
});

router.post('/users/:id/reject', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (user.role === 'admin') return res.status(400).json({ error: 'On ne refuse pas un admin.' });
  user.status = 'rejected';
  await db.write();
  res.json({ user: publicUser(user) });
});

// Promouvoir / rétrograder admin.
router.post('/users/:id/role', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  const role = req.body.role === 'admin' ? 'admin' : 'member';
  if (user.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Tu ne peux pas retirer ton propre rôle admin.' });
  }
  user.role = role;
  await db.write();
  res.json({ user: publicUser(user) });
});

router.delete('/users/:id', async (req, res) => {
  await db.read();
  const user = findUser(req, res);
  if (!user) return;
  if (user.id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas te supprimer toi-même.' });
  db.data.users = db.data.users.filter((u) => u.id !== user.id);
  await db.write();
  res.json({ ok: true });
});

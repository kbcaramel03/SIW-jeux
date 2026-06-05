// Comptes de départ + fonction pour les créer si la base est vide.
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export const SEED = [
  { username: 'khadija', displayName: 'Khadija', role: 'admin', gender: 'F', password: 'admin1234' },
  { username: 'zineb', displayName: 'Zineb', role: 'member', gender: 'F', password: 'jeux1234' },
  { username: 'aya', displayName: 'Aya', role: 'member', gender: 'F', password: 'jeux1234' },
  { username: 'alia', displayName: 'Alia', role: 'member', gender: 'F', password: 'jeux1234' },
  { username: 'yasmine', displayName: 'Yasmine', role: 'member', gender: 'F', password: 'jeux1234' },
];

// Crée les comptes uniquement si AUCUN compte n'existe encore.
// (Ainsi on ne recrée pas un compte que l'admin a volontairement supprimé.)
export async function ensureSeed(db, { log = () => {} } = {}) {
  await db.read();
  db.data.users ||= [];
  if (db.data.users.length > 0) return 0;

  for (const s of SEED) {
    db.data.users.push({
      id: nanoid(10),
      username: s.username,
      displayName: s.displayName,
      gender: s.gender,
      passwordHash: await bcrypt.hash(s.password, 10),
      role: s.role,
      status: 'approved',
      createdAt: new Date().toISOString(),
    });
    log(`✓ Compte créé : ${s.displayName} (${s.username}) — mot de passe : ${s.password}`);
  }
  await db.write();
  return SEED.length;
}

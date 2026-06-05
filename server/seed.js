// Crée les comptes de départ manuellement : npm run seed
import db from './db.js';
import { ensureSeed } from './seedData.js';

const created = await ensureSeed(db, { log: console.log });
if (created === 0) console.log('Des comptes existent déjà, rien à faire.');
else {
  console.log(`\n${created} compte(s) créé(s).`);
  console.log('IMPORTANT : dites à chacune de changer son mot de passe après la 1re connexion !\n');
}

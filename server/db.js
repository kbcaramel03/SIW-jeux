// Base de données.
// - En local (dev) : un simple fichier JSON (server/data/db.json).
// - En ligne (si DATABASE_URL est défini) : une base Postgres persistante (Neon).
// Le reste du code utilise db.data.users sans savoir lequel des deux est actif.
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const defaultData = { users: [] };

// Adaptateur Postgres : stocke tout l'objet JSON dans une seule ligne (table kv).
// Suffisant et simple pour un petit groupe ; aucune migration de schéma à gérer.
class PostgresAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
    this.ready = null;
  }

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const { default: pg } = await import('pg');
      this.pool = new pg.Pool({
        connectionString: this.connectionString,
        ssl: { rejectUnauthorized: false }, // requis par Neon
      });
      await this.pool.query('CREATE TABLE IF NOT EXISTS kv (id text PRIMARY KEY, data jsonb NOT NULL)');
    })();
    return this.ready;
  }

  async read() {
    await this.init();
    const res = await this.pool.query('SELECT data FROM kv WHERE id = $1', ['main']);
    return res.rows[0]?.data ?? null;
  }

  async write(data) {
    await this.init();
    await this.pool.query(
      'INSERT INTO kv (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      ['main', data]
    );
  }
}

function buildAdapter() {
  if (process.env.DATABASE_URL) {
    console.log('🗄️  Stockage : base de données Postgres (en ligne).');
    return new PostgresAdapter(process.env.DATABASE_URL);
  }
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(__dirname, 'data');
  mkdirSync(dataDir, { recursive: true });
  console.log('🗄️  Stockage : fichier JSON local (server/data/db.json).');
  return new JSONFile(join(dataDir, 'db.json'));
}

const db = new Low(buildAdapter(), defaultData);
await db.read();
db.data ||= defaultData;
db.data.users ||= [];
db.data.conversations ||= []; // chats privés & groupes
db.data.messages ||= [];
await db.write();

export default db;

// Renvoie l'utilisateur sans le hash du mot de passe (sûr à envoyer au client).
export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

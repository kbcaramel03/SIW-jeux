// Configuration centrale. En production, mets ces valeurs dans des variables
// d'environnement (Render le permet) plutôt que de garder les valeurs par défaut.
export const PORT = process.env.PORT || 3001;

// Secret pour signer les jetons de connexion (JWT). À CHANGER en production !
export const JWT_SECRET = process.env.JWT_SECRET || 'change-moi-en-prod-soiree-jeux';

// Durée de validité d'une connexion.
export const TOKEN_TTL = '30d';

// Origines autorisées à appeler l'API en développement (le client Vite).
export const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const IS_PROD = process.env.NODE_ENV === 'production';

# 🎮 Soirée Jeux

Site de jeux multijoueurs pour la team (Khadija, Zineb, Aya, Alia, Yasmine).
Lobby, comptes avec validation admin, chat intégré, et jeux en temps réel.

## Jeux
- ✅ **Code Names** (avec vos prénoms intégrés)
- 🔜 Bataille navale, Uno, Flip 7, Bullshit, Conspiracy, Scribbl, Loup Garou

## Installation (une seule fois)
```bash
npm install            # dépendances du serveur
npm install --prefix client   # dépendances du client
npm run seed           # crée les 5 comptes de départ
```

## Lancer en développement
```bash
npm run dev
```
Puis ouvre **http://localhost:5173**

## Comptes de départ (à changer après la 1re connexion !)
| Prénom   | Identifiant | Mot de passe | Rôle   |
|----------|-------------|--------------|--------|
| Khadija  | `khadija`   | `admin1234`  | admin  |
| Zineb    | `zineb`     | `jeux1234`   | membre |
| Aya      | `aya`       | `jeux1234`   | membre |
| Alia     | `alia`      | `jeux1234`   | membre |
| Yasmine  | `yasmine`   | `jeux1234`   | membre |

## Validation des inscriptions
Quand quelqu'un s'inscrit, son compte est **en attente**. Khadija (admin) le valide
dans le **Panel Admin** (👑 en haut à droite).

## Mise en production (plus tard)
```bash
npm run build          # compile le client
NODE_ENV=production npm start
```
Le serveur sert alors le site compilé sur le port défini (`PORT`).
Pense à définir `JWT_SECRET` en variable d'environnement.

## Architecture
- `server/` — Node + Express + Socket.IO, stockage JSON (lowdb)
- `client/` — React (Vite), responsible téléphone + ordi
- `server/games/` — un fichier par jeu (logique pure)

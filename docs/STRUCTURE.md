# Structure du projet — où travailler

Chaque gestion a son dossier. Évitez d’éditer les fichiers des autres.

## Frontend (`app/`)

| Gestion | Dossier | Fichiers à éditer |
| --- | --- | --- |
| Ressources | `app/gestions/resources/` | UI, onglets, `editor-modal.tsx`, `resources.css` |
| Véhicules | `app/gestions/vehicles/` | `index.tsx`, `vehicles.css` |
| Réservations | `app/gestions/reservations/` | `index.tsx`, `reservations.css` |
| Comptabilité | `app/gestions/billing/` | `index.tsx`, `billing.css` (+ `lib/billing.ts` plus tard) |
| Réclamations | `app/gestions/complaints/` | `index.tsx`, `complaints.css` |

- **Shell / auth / navigation** : `app/page.tsx` (entrée mince) + composants dans `app/components/` (`auth-gate`, `dashboard`, etc.). Le shell métier actuel vit encore dans `app/gestions/resources/resources-gestion.tsx` (seule gestion complète) ; les autres gestions sont montées via `app/gestions/index.ts`.
- **UI partagée** (Icon, Badge, Avatar, Dialog, Empty, Actions) : `app/components/ui/` (`icons.tsx`, pas `icon.tsx` — réservé par Next.js) — ne les cassez pas pour les autres.
- **CSS de base** : `app/styles/base.css` (importé par `app/globals.css`). Ajoutez le style spécifique dans le `.css` de votre gestion.

## Backend (`backend/src/modules/`)

| Module | Dossier |
| --- | --- |
| Auth / comptes / santé | `modules/auth/` |
| Paramètres workspace | `modules/settings/` |
| Ressources | `modules/resources/` |
| Véhicules (stub `GET /api/vehicles/ping`) | `modules/vehicles/` |
| Réservations (stub) | `modules/reservations/` |
| Réclamations (stub) | `modules/complaints/` |
| Comptabilité | à ajouter en `modules/billing/` |

Les routes REST, noms de collections et DTO existants de Ressources / Auth / Settings **ne doivent pas changer**.

## Types partagés (`lib/`)

- `lib/access.ts` — rôles, permissions (`billing` = Comptabilité à l’affichage)
- `lib/resources.ts` — modèle Ressources
- `lib/workspace.ts` — thème / agence
- `lib/api.ts`, hooks `use-resources` / `use-workspace`

## Déploiement

Deux projets Vercel (frontend racine + API `backend/`). Voir `docs/DEPLOY.md`.

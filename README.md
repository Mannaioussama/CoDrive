# coDrive — Gestion des ressources

PWA responsive Next.js / React, API REST **NestJS 11**, base NoSQL **MongoDB** avec **Mongoose**. Le frontend conserve le design coDrive et les quatre sous-onglets : affectation, employés, horaires, matériel.

## Démarrage local

Prérequis : Node.js 22.12+ (24 recommandé), npm, MongoDB 7+ avec `mongod` accessible dans le PATH. MongoDB est déjà installé sur la machine utilisée pour ce projet.

Depuis la racine :

```sh
npm install
npm run db:start
npm run api:build
```

`db:start` lance un MongoDB dédié sur `127.0.0.1:27018` avec un replica set local à un nœud (`fleetpro-rs`). Ses données persistantes et son journal sont dans `.data/mongodb/`, ignoré par Git. Il ne modifie pas les instances MongoDB d’autres projets. Les transactions nécessitent ce replica set, ou un cluster MongoDB Atlas compatible.

La base démarre vide. Ajoutez vos employés, tâches, créneaux, équipements et articles depuis les formulaires. Aucun jeu de démonstration n’est chargé au démarrage et aucune commande de remplissage n’est fournie.

Dans deux terminaux :

```sh
# Terminal 1 : backend, http://127.0.0.1:4000
npm run api:start

# Terminal 2 : frontend, http://localhost:3017
npm run dev -- --port 3017
```

Pour développer le backend avec recompilation et redémarrage automatiques : `npm run api:dev`.

Pour une version compilée : `npm run build:all`, puis `npm run api:start` et `npm start -- --port 3017` dans deux terminaux. Webpack est utilisé pour respecter les restrictions locales de Turbopack.

## Configuration

Les valeurs par défaut permettent de démarrer sans fichier `.env`. Des modèles versionnés existent :

- `.env.example` à la racine : `API_URL` (destination du proxy Next.js). Copier en `.env.local` pour le frontend.
- `backend/.env.example` : `MONGODB_URI`, `HOST`, `PORT`, `CORS_ORIGINS`, `ALLOWED_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`, `SMTP_*`. Copier en `backend/.env` (les scripts npm workspace s’exécutent dans `backend/`).
- MongoDB : `mongodb://127.0.0.1:27018/fleetpro?replicaSet=fleetpro-rs`.
- Next.js transmet `/api/*` à NestJS. Le navigateur utilise la même origine que l’interface. `API_URL` est lu au **build** : redémarrer/recompiler Next.js après modification.

L’API est liée par défaut à `127.0.0.1` et protégée par des sessions de 24 heures. L’inscription publique (`POST /api/auth/setup`) est fermée. Si `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont définis et qu’aucun administrateur avec mot de passe n’existe encore, l’API crée ce compte au démarrage. Les mots de passe sont hachés avec scrypt et un sel aléatoire ; seul un condensat du jeton de session est stocké dans MongoDB. Le cookie est HttpOnly et SameSite=Lax, avec Secure en HTTPS. Déconnexion, désactivation et changement de rôle révoquent les sessions concernées. Une limitation (10 tentatives / 15 min / IP, collection MongoDB `auth_attempts`) protège la connexion et l’activation.

Déploiement Vercel (frontend + API + Atlas) : voir [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Comptes, invitations et permissions

Dans **Ressources → Employés & compétences**, un e-mail est obligatoire pour les nouveaux employés. La fiche et le compte sont créés dans une même transaction, avec le rôle d’accès choisi explicitement par l’administrateur. Le lien d’activation à usage unique expire après 48 heures ; renvoyer une invitation invalide le lien précédent. Un compte non activé ou désactivé ne peut pas se connecter. L’administrateur peut attribuer les rôles d’accès et désactiver un compte sans supprimer la fiche ni l’historique. Le métier de l’employé est indépendant du rôle d’accès.

- `ADMIN` : accès aux ressources, aux paramètres et à la gestion des comptes.
- `GESTIONNAIRE_FLOTTE` : véhicules et maintenance ; métier à choisir entre Mécanicien et Préparateur automobile.
- `AGENT_RESERVATION` : réservations et disponibilités.
- `AGENT_FACTURATION` : tarifs et facturation.
- `CHARGE_CLIENTELE` : réclamations clients.

Ces quatre rôles non administrateurs disposent actuellement de leur espace personnel avec leurs tâches et horaires. Les autres modules métier restent à développer. Tous les rôles peuvent consulter les cinq gestions. `ADMIN` peut tout modifier ; les autres rôles peuvent modifier uniquement leur gestion : flotte → véhicules, réservation → réservations, facturation → tarifs/facturation, clientèle → réclamations. Seul `ADMIN` peut modifier les ressources, les paramètres et les permissions. La lecture des paramètres sert au thème et au logo communs ; leur écran de modification reste réservé à l’administrateur. Les anciennes valeurs `EMPLOYE`, `MECANICIEN` et `RESPONSABLE_RESSOURCES` ne sont plus acceptées pour la connexion ; leurs comptes conservent leurs données et doivent recevoir un rôle valide dans Comptes & permissions.

L’espace personnel utilise `/api/me/tasks`. La mise à jour de l’avancement (`À faire`, `En cours`, `Terminée`) vérifie côté serveur que la tâche est affectée au compte connecté. L’état d’affectation reste distinct de l’avancement.

### Invitations SMTP

Configurer dans `backend/.env` (fichier local ignoré par Git) :

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=adresse@example.com
SMTP_PASSWORD=mot_de_passe_application
SMTP_FROM=coDrive <adresse@example.com>
APP_URL=http://adresse-du-serveur:3017
```

Le port 465 utilise TLS direct ; 587 utilise STARTTLS. Avec Gmail, utiliser un mot de passe d’application associé au compte d’envoi. `APP_URL` doit être accessible au destinataire. En l’absence de configuration ou si l’envoi échoue, le gestionnaire voit explicitement que le message n’est pas envoyé et peut copier le lien. Les tests d’intégration désactivent SMTP et utilisent une base isolée ; aucun e-mail réel n’est envoyé.


## API REST

Documentation interactive avec schémas JSON : **http://127.0.0.1:4000/api/docs**.

| Méthode | Route | Fonction |
| --- | --- | --- |
| GET | `/api/health` | État de l’API et connexion MongoDB |
| GET | `/api/resources` | Instantané des cinq collections |
| GET | `/api/resources/:kind` | Liste d’une collection |
| GET | `/api/resources/:kind/:id` | Détail d’une ressource |
| POST | `/api/resources/:kind` | Création, identifiant généré par le serveur |
| PUT | `/api/resources/:kind/:id` | Remplacement complet |
| PATCH | `/api/resources/:kind/:id` | Modification partielle |
| DELETE | `/api/resources/:kind/:id` | Suppression |
| POST | `/api/assignments/:id` | Recalcul et confirmation d’une recommandation |
| POST | `/api/assignments/auto` | Affectation en lot |

`:kind` : `employees`, `tasks`, `shifts`, `equipment`, `stock`. Les réponses GET détail/liste retournent la ressource ou la liste ; les mutations CRUD retournent l’instantané complet actualisé. L’affectation en lot retourne `{ store, assigned, remaining }`.

Les DTO rejettent les propriétés inconnues, champs manquants, statuts invalides, quantités négatives, charges hors de 0–100 %, dates impossibles et horaires incohérents. Les champs des corps JSON correspondent aux types de `lib/resources.ts`, sans `id`.

Exemple de création :

```sh
curl -X POST http://127.0.0.1:4000/api/resources/stock \
  -H 'Content-Type: application/json' \
  -d '{"name":"Filtre à huile","quantity":12,"minimum":5,"unit":"pièces"}'
```

## Persistance et règles métier

- Cinq collections MongoDB distinctes, index uniques sur `id` et index de recherche des horaires/affectations.
- Une transaction MongoDB pour chaque mutation. Une révision commune sérialise les écritures concurrentes avant la vérification des disponibilités ; deux affectations simultanées ne réservent pas le même employé.
- Affectation possible uniquement avec la compétence requise, un créneau couvrant toute la mission et sans mission simultanée ; les congés et une charge de 100 % bloquent l’affectation.
- Suppression d’un employé : tâches remises en proposition et horaires supprimés dans la même transaction.
- Un créneau ne peut pas chevaucher un autre créneau, ni être modifié/supprimé en laissant une tâche affectée sans couverture.
- Retirer une compétence encore utilisée par une tâche affectée est refusé.
- Dans le module Ressources, la charge de travail reste une valeur déclarée manuellement. Les recommandations sont déterministes et utilisent exclusivement les données enregistrées. Les besoins affichent les missions sans candidat sur les sept prochains jours, les employés dont la charge dépasse 80 %, et les stocks sous le seuil. Aucun chiffre de prévision fictif, service IA externe ou lien aux réservations/véhicules.

Les données sont réellement persistées dans MongoDB. L’interface attend la réponse du serveur avant d’afficher un succès et garde le formulaire ouvert en cas de refus. Les données sont actualisées au retour sur la page et toutes les 30 secondes lorsqu’elle est visible.

## PWA / hors ligne

Le manifeste et les icônes permettent l’installation en HTTPS ou sur localhost. Le service worker précharge l’interface, les scripts, les styles et les polices après la première visite complète. Tester la PWA avec un build de production.

Les routes `/api/*` ne sont jamais mises en cache par le service worker. Le dernier instantané confirmé du serveur est conservé sous `fleetpro-api-cache-v1` dans le navigateur : **hors ligne, consultation seulement dans un espace déjà ouvert et authentifié**. Une nouvelle ouverture nécessite une connexion au serveur pour vérifier la session. Les écritures nécessitent le serveur et ne sont pas mises en attente. Une bannière signale une API inaccessible et propose de réessayer.

Les anciennes données de la version uniquement locale (`fleetpro-resources-v1`) ne sont ni supprimées ni importées automatiquement dans MongoDB.

## Vérifications

```sh
npm run lint
npm test
npm run api:build
npm run test:api
npm run build
```

Les tests d’intégration démarrent une API sur le port 4011, créent une base temporaire `fleetpro_test_<uuid>`, vérifient les cinq CRUD, la validation, les conflits concurrents, les suppressions en cascade et les documents réellement écrits dans MongoDB. Ils suppriment uniquement cette base de test. MongoDB doit être démarré. Variables facultatives : `MONGODB_TEST_URI`, `API_TEST_PORT`.

Le planning s’ouvre sur la semaine courante. Les formulaires utilisent la date du jour. Les compétences suggérées proviennent des employés créés et restent saisissables librement. Aucun nom de gestionnaire, agence ou personnel fictif n’est affiché.

Les seules données de test résident dans `tests/fixtures/` et ne sont importées ni par le frontend ni par NestJS. Les listes de rôles et de statuts sont des choix métier, pas des enregistrements.

Le script ponctuel `scripts/remove-legacy-demo.mjs` identifie les anciens exemples inchangés de la version précédente. Par défaut, il ne fait qu’un contrôle. Avec `--apply`, il enregistre d’abord une sauvegarde dans `.data/backups/` puis retire ces exemples dans une transaction. Les enregistrements modifiés et les dépendances des tâches utilisateur sont conservés. Ce script n’est jamais exécuté au démarrage.

Les polices locales proviennent du modèle fourni ; leur licence est conservée dans `public/FONT-LICENSE.txt`.

Références officielles : [NestJS / MongoDB](https://docs.nestjs.com/techniques/mongodb), [validation NestJS](https://docs.nestjs.com/techniques/validation).

## Personnalisation de l’espace coDrive

La sidebar donne accès aux **Paramètres** et au **Tableau de bord**. Les paramètres sont sauvegardés dans la collection MongoDB `workspace_settings` via `GET /api/settings` et `PUT /api/settings` :

- Nom et logo de l’agence (PNG, JPEG ou WebP, 2 Mo maximum avant optimisation côté navigateur ; 256 Ko maximum après optimisation côté serveur). Le logo est redimensionné à 512 px et stocké en data URL dans MongoDB. Les SVG ne sont pas acceptés.
- Thème clair, sombre ou automatique selon l’appareil.
- Couleur principale et couleur d’accent, avec aperçu avant enregistrement.
- Tableau de bord opérationnel (véhicules, réservations, ressources et alertes), analytique (revenus, dépenses, réservations et utilisation du parc) ou intelligent (maintenance, demande, tarification, ressources et sentiments). Ces trois pages d’accueil affichent des données statiques de démonstration clairement identifiées, isolées dans `lib/dashboard-demo.ts` et le composant dashboard. Elles ne lisent ni ne modifient les données métier MongoDB. Le choix du dashboard est persisté dans MongoDB ; seuls la présentation et l’ordre de priorité des informations de l’accueil changent. Les cinq modules et leurs fonctionnalités sont inchangés. L’ancienne préférence `compact` est lue comme `intelligent` pour conserver la compatibilité.

Les paramètres sont partagés par l’agence dans cette version mono-espace et accessibles uniquement après authentification avec le compte administrateur. Les choix sont conservés au rechargement et une copie permet leur affichage hors ligne. Les anciennes clés techniques `fleetpro-*` et le nom de base `fleetpro` sont conservés pour éviter toute perte de données ; le nom affiché de l’application est **coDrive**.

La page d’accueil est désormais le dashboard choisi. Le dashboard analytique propose un graphique revenus/dépenses, des statistiques de réservations par jour ou mois, le taux d’utilisation et la ventilation des dépenses. L’opérationnel regroupe le parc, les réservations filtrables, les ressources et les alertes. L’intelligent illustre les cinq axes IA sans moteur prédictif connecté. Les exemples restent exclusivement à l’accueil, jamais dans les collections de gestion. Les modules non développés conservent leur état désactivé dans la navigation.

Dans le formulaire d’ajout, le champ Métier apparaît uniquement pour Gestionnaire de flotte. Pour les autres rôles, l’intitulé de la fiche est déduit automatiquement du rôle d’accès. Le backend contrôle cette correspondance à la création.

Les contrôles de lecture/écriture sont partagés dans `lib/access.ts` et appliqués au niveau du garde NestJS. Les quatre modules métier non implémentés affichent un écran d’attente précisant le droit attribué. Les employés peuvent toujours consulter et mettre à jour l’avancement de leurs propres tâches via `/api/me/tasks`, sans pouvoir modifier les affectations ni les fiches des ressources.

## Architecture MVC

coDrive utilise MVC pour une application avec une API REST : les vues sont rendues par Next.js, les contrôleurs NestJS exposent les routes HTTP, et les modèles représentent les données MongoDB. Les services assurent la logique métier entre les contrôleurs et les modèles.

```text
app/                          Vues Next.js (interface utilisateur)
backend/src/
├── controllers/              Contrôleurs HTTP : auth, comptes, ressources,
│                             affectations, espace personnel, paramètres, santé
├── services/                 Logique métier : auth, ressources, paramètres
├── models/                   Schémas Mongoose : ressources et paramètres
├── dto/                      Validation des entrées et schémas OpenAPI
├── guards/                   Authentification et permissions
├── app.module.ts             Injection des dépendances et assemblage
└── main.ts                   Démarrage de l’API
```

Les services utilisent Mongoose pour les ressources et les paramètres, et le pilote MongoDB fourni par la connexion Mongoose pour les comptes et sessions. Les contrôleurs renvoient du JSON ; ils ne rendent pas de templates HTML, puisque les vues sont dans Next.js. Les modèles ne sont pas des composants React. Les fichiers dans `backend/dist/` sont générés à la compilation et ne doivent pas être modifiés. Les routes REST et les collections restent identiques après cette réorganisation.

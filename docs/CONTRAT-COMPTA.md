# CoDrive — Contrat d'interface : Gestion Comptabilité

**Responsable : Oussama (Comptabilité / Finance)** · Version 1 · 21/10/2026

Ce document décrit **ce dont la Comptabilité a besoin des autres gestions**, et **ce que la Comptabilité fournit en retour**.
Règle d'or : on ne modifie pas les champs listés ici sans prévenir le groupe. Si un champ doit changer, on en discute avant.

Gestions : **Véhicules** · **Réservations** · **Réclamations** · **Ressources** · **Comptabilité** (moi).

---

## 0. Règles générales (valables pour tout le monde)

1. **Identifiants** : chaque enregistrement a un `id` (chaîne, UUID généré par le serveur), jamais modifié. On référence toujours un autre enregistrement par son `id` (`vehicleId`, `reservationId`, `clientId`, …).
2. **Dates** : `YYYY-MM-DD`. **Heures** : `HH:mm`. Date + heure complète : ISO 8601.
3. **Montants** : toujours en **millimes (entier)**. 1 DT = 1000 millimes (le dinar a 3 décimales). Exemple : 45,500 DT → `45500`. Jamais de nombre à virgule pour l'argent. Devise unique : DT.
4. **Statuts** : écrits **exactement** comme dans ce document (mêmes majuscules, mêmes accents), via une constante TypeScript partagée dans `lib/<gestion>.ts`.
5. **Ne jamais supprimer** un enregistrement déjà utilisé par la Comptabilité (réservation, client, véhicule, sinistre). On change son **statut** (ex. `annulée`, `hors service`). Une facture ne peut pas pointer vers un enregistrement disparu.
6. **Lecture seule chez les autres** : chaque gestion écrit uniquement dans **ses propres collections**. La Comptabilité lit vos données via vos routes `GET` (ou votre service exporté) et **n'écrit jamais chez vous**. Vous n'écrivez jamais dans les collections `billing_*`.
7. **Routes** : chacun garde sa clé de route déjà prévue dans le garde d'accès : `vehicles`, `reservations`, `complaints`, `resources`, **`billing` (Comptabilité)**. Exemple : `/api/vehicles/...`, `/api/billing/...`.
8. **Fichiers** : un dossier par gestion (frontend `app/gestions/<gestion>/`, backend `backend/src/modules/<gestion>/`, types partagés `lib/<gestion>.ts`). On ne touche pas aux dossiers des autres.
9. **Git** : une branche par gestion (`feature/<gestion>`), pull request vers `main`, relecture par au moins une personne. Chaque branche a son déploiement de prévisualisation sur Vercel.
10. **Taxes et taux** (TVA, timbre fiscal, retenue à la source) : ils sont gérés **par la Comptabilité** dans ses paramètres. Personne d'autre ne les écrit en dur dans son code.

---

## 1. Ce que la Comptabilité fournit aux autres

| Route (lecture ou appel) | Pour qui | Rôle |
|---|---|---|
| `GET /api/billing/tarifs/categories` | Véhicules, Réservations | Liste des catégories et tarif journalier de base (affichage). |
| `POST /api/billing/quote` | Réservations | Calcule le prix d'une location (voir §3). |
| `GET /api/billing/invoices?reservationId=…` | Réservations, Réclamations | Facture liée à une réservation + son état de paiement. |
| `GET /api/billing/invoices/:id` | Réclamations | Détail d'une facture (pour une réclamation). |

**La liste des catégories de véhicules est définie par la Comptabilité** : `ECONOMIQUE`, `COMPACTE`, `BERLINE`, `SUV`, `PREMIUM`, `UTILITAIRE`. Elle sera exportée depuis `lib/billing.ts`. Si une catégorie manque, on me le demande.

**Le prix de location n'est jamais saisi sur le véhicule.** Il vient de la catégorie du véhicule + les règles de tarification (saison, durée, entreprise partenaire).

---

## 2. Gestion VÉHICULES → ce que j'ai besoin de recevoir

### 2.1 Véhicule
| Champ | Type | Obligatoire | Remarque |
|---|---|---|---|
| `id` | string | oui | |
| `immatriculation` | string | oui | |
| `marque`, `modele` | string | oui | |
| `categorie` | `ECONOMIQUE` \| `COMPACTE` \| `BERLINE` \| `SUV` \| `PREMIUM` \| `UTILITAIRE` | **oui** | **Sans catégorie, pas de prix.** Le formulaire doit refuser l'ajout d'un véhicule sans catégorie. |
| `statut` | `disponible` \| `loué` \| `en maintenance` \| `hors service` | oui | |
| `kilometrage` | entier | non | |

Pas de champ prix sur le véhicule.

### 2.2 Intervention / maintenance
| Champ | Type | Obligatoire |
|---|---|---|
| `id`, `vehicleId` | string | oui |
| `type` | `révision` \| `réparation` \| `changement de pièces` \| `pneumatiques` \| `carrosserie` | oui |
| `date` | date | oui |
| `description` | string | oui |
| `pieces` | liste de `{ nom, quantite }` | oui si `changement de pièces` |
| `fournisseur` | string (garage ou vendeur de pièces) | oui si externe |
| `statut` | `planifiée` \| `en cours` \| `terminée` \| `annulée` | oui |
| `coutEstime` | entier (millimes) | non |

**Règle** : quand une intervention passe à `terminée` avec des pièces changées ou un fournisseur externe, la Comptabilité crée automatiquement une **dépense « justificatif manquant »** liée à `maintenanceId`. Vous n'avez **rien d'autre à faire** : ne saisissez pas le montant définitif, c'est la facture qui le donne.

### 2.3 Sinistre (déclaration opérationnelle)
Votre gestion déclare l'accident. **La Comptabilité tient le dossier financier** (factures de réparation, assurance, franchise, refacturation) lié par `sinistreId`.

| Champ | Type | Obligatoire |
|---|---|---|
| `id` | string | oui |
| `vehicleId` | string | oui |
| `reservationId` | string | non (null si véhicule non loué) |
| `date`, `lieu` | date, string | oui |
| `description` | string | oui |
| `gravite` | `léger` \| `moyen` \| `grave` | oui |
| `responsable` | `client` \| `tiers` \| `agence` \| `inconnu` | oui |
| `constatAmiable` | booléen | oui |
| `photos` | liste d'URL | non |
| `statut` | `déclaré` \| `en expertise` \| `en réparation` \| `clôturé` | oui |

**Règle** : dès qu'un sinistre est `déclaré`, la Comptabilité ouvre le dossier financier. Quand vous le passez à `clôturé`, je vérifie que toutes les factures sont reçues.

---

## 3. Gestion RÉSERVATIONS → ce que j'ai besoin de recevoir

### 3.1 Client (entreprise cliente) — *à confirmer : qui en est propriétaire ?*
Je propose que **Réservations** possède la fiche client.

| Champ | Type | Obligatoire | Remarque |
|---|---|---|---|
| `id` | string | oui | |
| `raisonSociale` | string | oui | |
| `matriculeFiscal` | string | **oui** | Obligatoire sur une facture. |
| `adresse`, `email`, `telephone` | string | oui | |
| `delaiPaiementJours` | entier | non | Défaut : 30. |

### 3.2 Réservation
| Champ | Type | Obligatoire |
|---|---|---|
| `id`, `clientId`, `vehicleId` | string | oui |
| `categorie` | catégorie (copiée du véhicule à la réservation) | oui |
| `dateDebut`, `dateFin` | date | oui |
| `statut` | `en attente` \| `confirmée` \| `en cours` \| `terminée` \| `annulée` | oui |
| `dateAnnulation` | date | si `annulée` |
| `prolongations` | liste de `{ ancienneFin, nouvelleFin }` | non |
| `extras` | liste de `{ libelle, montant }` (carburant manquant, dégâts mineurs, kilomètres en plus…) | non |
| `quoteId`, `prixTotal` | string, entier | **oui** (copiés de ma réponse `POST /quote`) |

**Règles**
1. **Au moment de réserver**, vous appelez `POST /api/billing/quote` avec `{ categorie, clientId, dateDebut, dateFin }`. Je réponds avec le détail du prix : tarif journalier, nombre de jours, coefficient de saison, remise durée, remise partenaire, total. Vous stockez `quoteId` et `prixTotal` dans la réservation.
2. **Le prix est figé** à la réservation. Une modification de tarif plus tard ne change **pas** les réservations existantes.
3. **Si les dates changent** (prolongation, raccourcissement), vous rappelez `quote` pour obtenir un nouveau prix.
4. **Statut `terminée`** → la Comptabilité génère le **brouillon de facture** (une seule fois par `reservationId`).
5. **Statut `annulée`** → vous mettez `dateAnnulation` ; j'applique la pénalité d'annulation si la règle s'applique.
6. Vous pouvez **afficher** l'état de paiement d'une réservation en lisant `GET /api/billing/invoices?reservationId=…` (états : `non facturée`, `émise`, `payée`, `en retard`). Vous ne le modifiez jamais.

---

## 4. Gestion RÉCLAMATIONS → ce que j'ai besoin de recevoir

### Réclamation et décision
| Champ | Type | Obligatoire |
|---|---|---|
| `id`, `clientId` | string | oui |
| `reservationId` | string | non |
| `statut` | `en attente` \| `en cours` \| `résolue` | oui |
| `decision` | `{ type, montant, motif, dateDecision }` | si `résolue` |
| `decision.type` | `remboursement` \| `geste commercial` \| `rejetée` | oui |
| `decision.montant` | entier (millimes) | si remboursement ou geste commercial |

**Règle** : quand une décision avec montant est validée, la Comptabilité crée un **avoir** (facture d'avoir) lié à la réservation. Vous ne calculez rien : vous donnez le montant et le motif.

---

## 5. Gestion RESSOURCES → ce que j'ai besoin de recevoir

### Achat / réapprovisionnement
| Champ | Type | Obligatoire |
|---|---|---|
| `id` | string | oui |
| `stockId` ou `equipmentId` | string | oui |
| `quantite` | entier | oui |
| `fournisseur` | string | oui |
| `date` | date | oui |

**Règle** : à chaque réapprovisionnement ou achat d'équipement, la Comptabilité crée une dépense « justificatif manquant ». Les salaires et la paie ne sont **pas** dans la version 1.

---

## 6. Ce que la Comptabilité fait de son côté (information)

- **Tarifs** : tarif de base par catégorie, coefficients de saison (par période), remises selon la durée, tarifs spécifiques par entreprise partenaire, règles de pénalité (annulation tardive, retard de restitution…). Les prix dynamiques sont **proposés** par l'IA, **validés** par un humain.
- **Facturation clients** : numérotation continue (`FAC-2026-0001`), lignes, HT, TVA, timbre fiscal, TTC, statuts `brouillon` → `émise` → `payée` / `en retard`, relances automatiques.
- **Dépenses et justificatifs** : toute facture fournisseur, saisie à la main ou envoyée par **Telegram** (le bot lit la photo, l'enregistrement arrive en `à valider`).
- **Sinistres et assurances** : dossier financier, déclaration à l'assureur, franchise, indemnisation, refacturation éventuelle au client.
- **Fiscalité** : échéances et déclarations.
- **Analyse (BI)** : chiffre d'affaires, dépenses, marge, impayés, prévisions.

---

## 7. Résumé : ce qu'il faut faire dans votre gestion

| Gestion | À faire |
|---|---|
| **Véhicules** | Catégorie obligatoire sur chaque véhicule. Interventions avec pièces et fournisseur. Sinistres avec les champs du §2.3. |
| **Réservations** | Fiche client avec matricule fiscal. Appeler `quote` à chaque réservation et stocker `quoteId` + `prixTotal`. Passer à `terminée` ou `annulée` proprement (avec `dateAnnulation`). |
| **Réclamations** | Décision structurée (`type`, `montant`, `motif`) avec le `reservationId`. |
| **Ressources** | Enregistrer les achats de stock et d'équipement avec fournisseur et date. |

**Questions ouvertes** (à répondre dans le groupe) :
1. Réservations est-elle bien propriétaire de la fiche client ?
2. Y a-t-il d'autres catégories de véhicules à ajouter à ma liste ?
3. Une réservation peut-elle changer de véhicule en cours de route ? (si oui : `vehicleId` devient une liste d'affectations)

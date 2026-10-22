# CoDrive — Ce dont la Comptabilité a besoin de vous

**Règles pour tous**
- Les montants sont toujours en **millimes (entiers)** : 45,500 DT = `45500`.
- Chaque enregistrement a un `id`, et on référence les autres par leur `id` (`vehicleId`, `reservationId`, `clientId`).
- On ne supprime pas un enregistrement, on change son **statut**.
- Chacun écrit seulement dans ses propres données. Moi je lis les vôtres, je n'écris jamais chez vous.

## 🚗 Véhicules
- Chaque véhicule a une **catégorie obligatoire** : `ECONOMIQUE`, `COMPACTE`, `BERLINE`, `SUV`, `PREMIUM`, `UTILITAIRE`. **Pas de prix sur le véhicule** : le prix vient de la catégorie (c'est moi qui le gère).
- **Interventions** : type, date, `vehicleId`, **pièces changées** (nom + quantité), **fournisseur/garage**, statut (`planifiée` / `en cours` / `terminée` / `annulée`). Quand c'est `terminée`, je réclame la facture. Vous ne saisissez pas le montant.
- **Sinistres** : `vehicleId`, `reservationId` (si loué), date, lieu, description, gravité, responsable (`client` / `tiers` / `agence` / `inconnu`), statut (`déclaré` / `en expertise` / `en réparation` / `clôturé`). Je m'occupe du côté financier (assurance, factures, franchise).

## 📅 Réservations
- **Client** : raison sociale, **matricule fiscal** (obligatoire sur une facture), adresse, email.
- **À chaque réservation**, appelez `POST /api/billing/quote` avec `{ categorie, clientId, dateDebut, dateFin }`. Je réponds avec le prix. **Stockez `quoteId` et `prixTotal` dans la réservation.** Le prix est figé, il ne change plus après.
- Si les dates changent, rappelez `quote`.
- Statuts : `en attente` / `confirmée` / `en cours` / `terminée` / `annulée`. Quand c'est **`terminée`**, je génère la facture. Si c'est **`annulée`**, mettez la `dateAnnulation` (j'applique la pénalité).

## 💬 Réclamations
- Quand une réclamation est résolue : `reservationId`, **type** (`remboursement` / `geste commercial` / `rejetée`), **montant**, **motif**. J'en fais un avoir. Vous ne calculez rien.

## 👷 Ressources
- Chaque **achat de stock ou d'équipement** : article, quantité, **fournisseur**, date. Je réclame la facture.

## Ce que je vous donne
- `POST /api/billing/quote` (prix d'une location)
- `GET /api/billing/invoices?reservationId=…` (facture + état : `non facturée` / `émise` / `payée` / `en retard`)
- `GET /api/billing/tarifs/categories` (catégories et prix de base)

**Questions pour le groupe** : qui possède la fiche client (je propose Réservations) ? Une réservation peut-elle changer de véhicule ?

# Test manuel — Comptabilité

Prérequis : MongoDB local (`npm run db:start`), API (`npm run api:build && npm run api:start`), frontend (`npm run dev -- --port 3017`). Compte **AGENT_FACTURATION** (finance) déjà créé.

## A. Navigation finance
1. Connectez-vous avec le compte finance.
2. La barre gauche affiche **COMPTABILITÉ** avec les onglets : Tarifs, Facturation clients, Dépenses, Sinistres, Fiscalité, Trésorerie — pas la liste admin des cinq gestions.
3. En bas : **Autres tableaux de bord** → choisir Véhicules / Réservations / … → vue en **consultation uniquement** (pas d’édition).
4. **Mes tâches** reste accessible.

## B. Tarifs & devis
1. Onglet **Tarifs** → saisir une catégorie + tarif DT/jour → **Enregistrer le tarif**.
2. Ajouter une saison (dates + bouton saison +20 %).
3. Choisir début/fin → **Calculer un devis** → total en DT et `quoteId` affichés.
4. (Optionnel) `node scripts/seed-demo-billing.mjs` puis **Actualiser** les suggestions → **Accepter** une suggestion → une saison est créée (rien ne change sans clic).

## C. Facturation
1. Onglet **Facturation clients** → remplir client + ligne → **Enregistrer brouillon**.
2. **Émettre** → numéro `FAC-AAAA-####`.
3. **Paiement partiel** → statut reste émise / solde diminue ; un second paiement peut passer à **payée**.
4. **Avoir** sur une facture émise → message de succès.
5. **Imprimer** → fenêtre d’impression.

## D. Dépenses & sinistres
1. Ajouter une dépense (fournisseur, date, TTC) → **Valider**.
2. Ouvrir un **dossier sinistre** → vérifier l’affichage du **coût net**.

## E. Fiscalité & KPI
1. Onglet **Fiscalité** → paramètres TVA/timbre marqués **à vérifier** ; résumé TVA du mois.
2. Ajouter une obligation ; une échéance passée apparaît en surbrillance.
3. Les KPI en haut (impayés, retards, dépenses à valider, TVA) se mettent à jour.

## F. Droits
1. Compte non-finance / non-admin : lecture possible sur `/api/billing/*` en GET, écriture refusée (403).
2. Admin voit **Comptabilité** dans GESTIONS avec les mêmes écrans et droits d’écriture.

## G. Intégration (optionnel)
`N8N_API_KEY=test` puis :
`curl -X POST http://127.0.0.1:4000/api/billing/integrations/receipt -H 'x-api-key: test' -H 'Content-Type: application/json' -d '{"telegramMessageId":"t1","ocr":{"fournisseur":"Garage","date":"2026-10-01","montantTTC":50000,"tva":9500}}'`

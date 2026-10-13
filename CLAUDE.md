# AgroGestion — Application de gestion agroalimentaire

Application web de gestion d'une entreprise agroalimentaire multi-produits :
catalogue, stocks par lot, achats, ventes, statistiques, production (optionnel).
Utilisée sur ordinateur, tablette et téléphone (responsive, mobile first).
Interface et code métier en français.

## Stack

- Next.js (App Router) + TypeScript, full-stack : pas d'API séparée.
- Tailwind CSS + shadcn/ui pour l'interface, Recharts pour les graphiques.
- Prisma 7 + PostgreSQL (schéma dans `prisma/schema.prisma`, config dans `prisma.config.ts`).
- Auth.js (NextAuth) pour la connexion et les rôles.
- Zod pour la validation des données.

## Organisation du code

```
src/
  app/            pages par module (App Router)
  components/     composants UI réutilisables
  server/
    actions/      Server Actions (vérifient session + rôle, valident avec Zod, appellent un service)
    services/     logique métier (stock, ventes, achats, stats) — aucune règle métier dans les pages
  lib/            client Prisma, auth, utilitaires
prisma/
  schema.prisma
  seed.ts
```

## Règles métier à respecter

- Montants en FCFA : entiers (`Int`), jamais de décimales. Affichage : `12 500 FCFA`.
- Quantités : `Decimal(14,3)`.
- Le stock d'un produit = somme des `quantiteRestante` de ses lots dans le dépôt.
- Toute variation de stock crée un `MouvementStock` (quantité + pour entrée, − pour sortie).
- Sortie des lots en **FEFO** (date de péremption la plus proche d'abord), tracée dans `LigneVenteLot`.
- Le stock ne peut jamais devenir négatif.
- Vente, réception, inventaire, transfert et production : toujours dans une `prisma.$transaction`.
- Aucune suppression physique des ventes, achats ou mouvements : annulation avec statut, motif et auteur.
- Numérotation des pièces via la table `Sequence` (ex. `FAC-2026-000123`), dans la même transaction.
- Vente à crédit refusée si solde client + total > `plafondCredit`.
- Actions sensibles (prix, remise, annulation, ajustement de stock) enregistrées dans `JournalAction`.
- Dates affichées au format JJ/MM/AAAA.

## Rôles

ADMIN, GERANT, MAGASINIER, CAISSIER, RESPONSABLE_PRODUCTION.
Le contrôle des droits se fait côté serveur dans chaque Server Action, pas seulement en masquant des menus.
Le caissier ne voit ni les prix d'achat ni les marges.

## Ordre de développement

1. Socle : projet, Tailwind + shadcn/ui, Prisma, Auth.js, layout responsive avec menu par rôle, seed.
2. Catalogue : catégories, unités, produits, conditionnements.
3. Achats : fournisseurs, bons de commande, réceptions (création des lots).
4. Ventes : écran de caisse, FEFO, paiements (espèces, Orange Money, Moov Money, crédit), factures PDF.
5. Stocks : pertes, transferts, inventaires, alertes de péremption et de stock bas.
6. Tableau de bord, statistiques, exports Excel et PDF.
7. Production, journal, tests, déploiement.

## Commandes

- `npm run dev` — serveur de développement
- `npx prisma migrate dev --name <nom>` — migration
- `npx prisma db seed` — données de test
- `npx prisma studio` — explorer la base

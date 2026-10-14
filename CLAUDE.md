# Sahelia — Application de gestion agroalimentaire

Application web de gestion d'une entreprise agroalimentaire multi-produits :
catalogue, stocks par lot, achats, ventes (caisse), clients et créances, dépenses, production,
statistiques, utilisateurs. Utilisée sur ordinateur, tablette et téléphone (responsive, installable).
Interface et code métier en français. Nom, slogan et signature : `src/lib/marque.ts`.

## Stack

- Next.js 16 (App Router) + TypeScript, full-stack : pas d'API séparée.
- Tailwind CSS (composants écrits à la main, pas de shadcn/ui), Recharts pour les graphiques.
- Prisma 7 + PostgreSQL (schéma dans `prisma/schema.prisma`, config dans `prisma.config.ts`).
- Auth.js (NextAuth v5) : identifiant + mot de passe, sessions JWT, rôles.
- Zod pour la validation, exceljs (fichiers Excel), pdf-lib (factures PDF), Vitest (tests).
- Next 16 : `proxy.ts` remplace `middleware.ts`. Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next.

## Organisation du code

```
src/
  app/(app)/      pages protégées par module (une page = un module ou une fiche)
  app/api/        routes de fichiers : exports Excel, facture PDF, modèle d'import, santé, auth
  components/     composants UI ("use client" seulement quand c'est nécessaire)
  server/
    actions/      Server Actions : vérifient session + rôle (exigerRole), valident avec Zod, appellent un service
    services/     logique métier (stock, ventes, achats, retours, stats…) — aucune règle métier dans les pages
  lib/            client Prisma, auth, session, droits, formats, erreurs, pdf, xlsx
prisma/           schema.prisma, migrations/, seed.ts (test), seed-admin.ts (production)
tests/            tests d'intégration Vitest sur une base dédiée (nom finissant par _test)
```

## Règles métier à respecter

- Montants en FCFA : entiers (`Int`), jamais de décimales. Affichage : `12 500 FCFA`.
- Quantités : `Decimal(14,3)`.
- Le stock d'un produit = somme des `quantiteRestante` de ses lots (non périmés pour la vente).
- Toute variation de stock crée un `MouvementStock` (quantité + pour entrée, − pour sortie).
- Sortie des lots en **FEFO** (péremption la plus proche d'abord), tracée dans `LigneVenteLot` ; lots périmés jamais vendus.
- Le stock ne peut jamais devenir négatif.
- Vente, réception, retour, inventaire, transfert, production, paiements : toujours dans une `prisma.$transaction` (Serializable).
- Aucune suppression physique des ventes, achats, dépenses, productions ou mouvements : annulation avec statut, motif et auteur. Une vente avec retours ne s'annule plus.
- Numérotation des pièces via la table `Sequence` (`FAC-`, `BC-`, `PROD-`, `AVO-`, `TRF-`), dans la même transaction.
- Vente à crédit refusée si solde client + **montant payé à crédit** > `plafondCredit`. Le solde baisse via `EncaissementClient` ou un retour remboursé « sur le compte ».
- Actions sensibles (prix, remise, annulation, retour, perte, ajustement, comptes) enregistrées dans `JournalAction`.
- Notifications : alertes calculées à la demande par rôle (`services/notifications.ts`) — cloche + page `/notifications`. Résumé quotidien par email (SMTP/nodemailer) via `/api/cron/alertes` protégé par `CRON_SECRET`. WhatsApp = liens `wa.me` (`lib/whatsapp.ts`), pas d'API.
- Gain net = marge brute (CA net des retours − coût d'achat des lots vendus) − pertes ± écarts d'inventaire − dépenses.
- Dates affichées au format JJ/MM/AAAA.

## Rôles

ADMIN, GERANT, MAGASINIER, CAISSIER, RESPONSABLE_PRODUCTION.
Le contrôle des droits se fait côté serveur dans chaque Server Action (`exigerRole`) et chaque page
(`exigerAccesModule`), pas seulement en masquant des menus. Le rôle est relu en base à chaque requête
(`utilisateurCourant`) : un compte désactivé perd l'accès immédiatement.
Le caissier ne voit ni les prix d'achat ni les marges. Menu et droits par module : `src/lib/roles.ts`.

## Commandes

- `npm run dev` — serveur de développement (redémarrer après un changement de schéma Prisma)
- `npm test` — tests (créent/utilisent la base `<nom>_test`, jamais la base de développement)
- `npm run build` / `npm start` — production
- `npx prisma migrate dev --name <nom>` — migration (terminal interactif requis)
- `npx prisma migrate deploy` — applique les migrations sans interaction (CI, production)
- `npx prisma db seed` — données de test (comptes `*@agro.test`, mot de passe `Test1234!`) ; refusé en production
- `npx prisma studio` — explorer la base

Déploiement : voir `DEPLOIEMENT.md`.

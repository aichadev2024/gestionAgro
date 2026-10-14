# Sahelia

> Gestion agroalimentaire · par Aïcha

Application web de gestion d'une entreprise agroalimentaire : catalogue, achats, ventes (caisse),
stocks par lot (FEFO), production, statistiques et gestion des utilisateurs par rôle.
Interface en français, utilisable sur ordinateur, tablette et téléphone.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Prisma 7 + PostgreSQL · Auth.js · Zod · Recharts · exceljs · pdf-lib · Vitest

## Installation

Prérequis : Node.js 20+ et un serveur PostgreSQL.

```bash
npm install
cp .env.example .env     # puis renseigner DATABASE_URL et AUTH_SECRET
npx prisma migrate dev   # crée les tables
npx prisma db seed       # données de test (comptes, dépôt, catégories, unités)
npm run dev              # http://localhost:3000
```

`AUTH_SECRET` se génère avec `npx auth secret`. Si le mot de passe de la base contient des
caractères spéciaux (`* ! @ #`…), il doit être encodé dans `DATABASE_URL`.

Après chaque modification de `prisma/schema.prisma`, relancer `npx prisma generate`
puis redémarrer le serveur de développement.

## Tests

```bash
npm test
```

Les tests utilisent une base séparée (`<nom de votre base>_test`, créée automatiquement) : ils ne touchent jamais
à vos données de développement.

## Déploiement

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) (Coolify, base PostgreSQL, premier administrateur, sauvegardes).

## Comptes de test (seed)

Mot de passe commun : `Test1234!` (à ne jamais utiliser en production).

| Rôle | Email |
|---|---|
| Administrateur | admin@agro.test |
| Gérant | gerant@agro.test |
| Magasinier | magasinier@agro.test |
| Caissier | caissier@agro.test |
| Responsable production | production@agro.test |

## Règles métier principales

- Montants en FCFA entiers ; quantités en `Decimal(14,3)`.
- Sorties de stock en FEFO (péremption la plus proche d'abord), tracées par lot.
- Le stock ne devient jamais négatif ; chaque variation crée un `MouvementStock`.
- Opérations sensibles dans une transaction ; aucune suppression physique des pièces
  (annulation avec motif et auteur) ; actions sensibles inscrites au journal.
- Droits contrôlés côté serveur dans chaque action ; le caissier ne voit ni prix d'achat ni marges.

Détail complet dans [CLAUDE.md](CLAUDE.md).

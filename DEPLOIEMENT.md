# Déploiement de Sahelia sur Coolify

Guide pour mettre l'application en ligne sur votre VPS (Coolify) avec une base PostgreSQL.

> Le `Dockerfile` n'a pas pu être testé en local (Docker absent du poste de développement) :
> surveillez les journaux de construction au premier déploiement.

## 1. Créer la base de données

1. Dans Coolify : **Nouvelle ressource → Base de données → PostgreSQL**.
2. Notez l'URL de connexion **interne** (« Postgres URL (internal) »), du type
   `postgres://postgres:MOT_DE_PASSE@NOM_INTERNE:5432/postgres`.
3. Si le mot de passe contient des caractères spéciaux (`* ! @ # / :`), ils doivent être encodés
   dans l'URL (`*` → `%2A`, `!` → `%21`, `@` → `%40`…).

## 2. Créer l'application

1. **Nouvelle ressource → Application → dépôt GitHub privé** (`aichadev2024/gestionAgro`, branche `main`).
2. **Build pack : Dockerfile**. Port exposé : **3000**.
3. **Health check** : chemin `/api/sante` (répond 200 seulement si la base est joignable).
4. Domaine : un sous-domaine en **HTTPS** (Coolify gère le certificat).

## 3. Variables d'environnement

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | l'URL interne PostgreSQL (voir étape 1) |
| `AUTH_SECRET` | une longue valeur aléatoire : `npx auth secret` |
| `AUTH_TRUST_HOST` | `true` (l'application est derrière le proxy de Coolify) |

Ne mettez **jamais** ces valeurs dans le dépôt Git (le fichier `.env` est ignoré).

## 4. Premier déploiement

Au démarrage, le conteneur applique tout seul les migrations (`prisma migrate deploy`).
La base est alors vide : **il n'y a aucun compte**. Créez le premier administrateur depuis le
terminal du conteneur (Coolify → l'application → *Terminal*) :

```bash
ADMIN_EMAIL="vous@exemple.com" ADMIN_NOM="Aïcha" ADMIN_PASSWORD="un-mot-de-passe-long-12+" \
  npx tsx prisma/seed-admin.ts
```

- Le mot de passe doit faire **12 caractères minimum**.
- Ne lancez **pas** `prisma db seed` : il crée des comptes de test (`*@agro.test`) et refuse de
  s'exécuter en production.
- Connectez-vous, puis créez les autres comptes depuis la page **Utilisateurs**.

## 5. Sauvegardes (indispensable)

1. Dans la ressource PostgreSQL de Coolify : **Backups → planifier** (au moins 1 fois par jour).
2. Destination **S3 / Cloudflare R2**, comme pour vos autres projets.
3. **Testez une restauration** sur une base vide avant d'avoir de vraies données : une sauvegarde
   jamais restaurée n'est pas une sauvegarde.

## 6. Mises à jour

- `git push` sur `main` → redéployer dans Coolify (ou activer le déploiement automatique).
- Les migrations s'appliquent au démarrage. **Elles ne sont pas réversibles automatiquement** :
  faites une sauvegarde manuelle avant une mise à jour qui change la base.

## 7. Liste de contrôle avant ouverture aux utilisateurs

- [ ] L'application répond en HTTPS et `/api/sante` renvoie `{"ok":true}`.
- [ ] Le compte administrateur de production existe, et aucun compte `*@agro.test`.
- [ ] `AUTH_SECRET` est unique à la production.
- [ ] Une sauvegarde a été créée **et restaurée** avec succès.
- [ ] Les rôles ont été vérifiés avec un compte de chaque type (un caissier ne voit ni prix d'achat, ni marges, ni statistiques).
- [ ] Les mots de passe initiaux ont été changés depuis « Mon profil ».

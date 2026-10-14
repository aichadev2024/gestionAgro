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

### Alertes par email (facultatif, gratuit avec Gmail)

Sans ces variables, l'application fonctionne normalement : seules les notifications **dans
l'application** (la cloche) sont actives.

1. Sur le compte Gmail qui enverra les emails : activez la **validation en deux étapes**, puis créez un
   **mot de passe d'application** (Compte Google → Sécurité → Mots de passe des applications).
   Ce n'est **pas** votre mot de passe Gmail habituel.
2. Ajoutez ces variables dans Coolify :

| Variable | Valeur |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | l'adresse Gmail d'envoi |
| `SMTP_PASSWORD` | le mot de passe d'application (16 caractères) |
| `SMTP_FROM` | `Sahelia <votre.adresse@gmail.com>` |
| `APP_URL` | l'adresse publique de l'application (pour le lien dans l'email) |
| `CRON_SECRET` | une valeur aléatoire de 16+ caractères (sans elle, la route d'envoi reste fermée) |

3. Dans l'application, chacun active le résumé depuis **Mon profil → Alertes par email**, et peut
   cliquer sur **Envoyer un email de test** pour vérifier la configuration.
4. Dans Coolify → l'application → **Scheduled Tasks** : créez une tâche quotidienne (par exemple
   `0 7 * * *`, tous les jours à 7 h) avec la commande :

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/alertes
```

Chaque personne reçoit **au plus un email par jour**, et **aucun s'il n'y a rien à signaler**.
Gmail limite l'envoi à environ 500 emails par jour : c'est largement suffisant pour une équipe.

### WhatsApp

Aucune configuration : les boutons « Relancer sur WhatsApp » (page Clients) et « Envoyer par WhatsApp »
(facture) ouvrent WhatsApp avec le message prêt, il suffit d'appuyer sur Envoyer. Le numéro d'un client
sans indicatif reçoit celui du pays défini dans `src/lib/marque.ts` (`indicatifPays`, 223 = Mali).

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
- [ ] (si emails) le bouton « Envoyer un email de test » fonctionne et la tâche quotidienne est créée.

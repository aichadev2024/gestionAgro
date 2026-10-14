# Image de production de Sahelia (Next.js + Prisma + PostgreSQL), construite par Coolify.
FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Valeur factice uniquement pour la compilation : aucune connexion n'est ouverte à ce moment-là.
# La vraie DATABASE_URL est fournie à l'exécution par Coolify.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Au démarrage : applique les migrations en attente puis lance le serveur.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

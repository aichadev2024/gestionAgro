// Création du premier compte administrateur en PRODUCTION (sans données de test).
// Usage : ADMIN_EMAIL=... ADMIN_NOM="..." ADMIN_PASSWORD=... npx tsx prisma/seed-admin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const nom = process.env.ADMIN_NOM?.trim() || "Administrateur";
  const motDePasse = process.env.ADMIN_PASSWORD ?? "";

  if (!email || !email.includes("@")) throw new Error("ADMIN_EMAIL manquant ou invalide.");
  if (motDePasse.length < 12) {
    throw new Error("ADMIN_PASSWORD : 12 caractères minimum pour le compte administrateur.");
  }
  if (/test1234/i.test(motDePasse)) throw new Error("Mot de passe de test interdit.");

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) {
    console.log(`Le compte ${email} existe déjà : rien à faire.`);
    return;
  }
  await prisma.user.create({
    data: { email, nom, role: "ADMIN", motDePasse: await bcrypt.hash(motDePasse, 12) },
  });
  // Un dépôt par défaut est nécessaire pour les réceptions, productions et ventes.
  await prisma.depot.upsert({
    where: { nom: "Dépôt principal" },
    update: {},
    create: { nom: "Dépôt principal" },
  });
  console.log(`Administrateur ${email} créé. Changez le mot de passe depuis « Mon profil » si besoin.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

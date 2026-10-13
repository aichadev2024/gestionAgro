import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MOT_DE_PASSE_TEST = "Test1234!"; // données de test uniquement

async function main() {
  const hash = await bcrypt.hash(MOT_DE_PASSE_TEST, 10);
  const utilisateurs: { nom: string; email: string; role: Role }[] = [
    { nom: "Administrateur", email: "admin@agro.test", role: "ADMIN" },
    { nom: "Gérant", email: "gerant@agro.test", role: "GERANT" },
    { nom: "Magasinier", email: "magasinier@agro.test", role: "MAGASINIER" },
    { nom: "Caissier", email: "caissier@agro.test", role: "CAISSIER" },
    { nom: "Resp. production", email: "production@agro.test", role: "RESPONSABLE_PRODUCTION" },
  ];
  for (const u of utilisateurs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, motDePasse: hash },
    });
  }

  await prisma.depot.upsert({
    where: { nom: "Dépôt principal" },
    update: {},
    create: { nom: "Dépôt principal" },
  });

  for (const nom of ["Céréales", "Huiles", "Boissons", "Conserves", "Épices"]) {
    await prisma.categorie.upsert({ where: { nom }, update: {}, create: { nom } });
  }
  for (const [nom, symbole] of [
    ["Kilogramme", "kg"],
    ["Litre", "L"],
    ["Pièce", "pc"],
    ["Carton", "ctn"],
  ]) {
    await prisma.unite.upsert({ where: { nom }, update: {}, create: { nom, symbole } });
  }
  console.log("Seed terminé. Comptes de test : *@agro.test");
}

main().finally(() => prisma.$disconnect());

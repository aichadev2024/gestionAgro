import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Garde-fou absolu : ces tests vident toutes les tables, ils ne doivent jamais viser la base de développement.
const base = new URL(process.env.DATABASE_URL ?? "http://x/inconnue").pathname;
if (!base.endsWith("_test")) {
  throw new Error(`Refus d'exécuter les tests sur la base « ${base} » : le nom doit finir par _test.`);
}

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const liste = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});

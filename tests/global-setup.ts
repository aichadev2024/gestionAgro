import { execSync } from "node:child_process";
import pg from "pg";
import { urlBaseTest } from "./url-base";

/** Crée la base de test si besoin et y applique toutes les migrations. */
export default async function setup() {
  const urlTest = urlBaseTest();
  const nomBase = new URL(urlTest).pathname.slice(1);
  if (!nomBase.endsWith("_test")) throw new Error(`Base de test invalide : ${nomBase}`);

  const admin = new URL(urlTest);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existe = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [nomBase]);
    if (existe.rowCount === 0) await client.query(`CREATE DATABASE "${nomBase}"`);
  } finally {
    await client.end();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: urlTest },
  });
}

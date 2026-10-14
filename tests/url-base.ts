/** URL de la base de test : même serveur que le développement, mais une base dont le nom finit par _test. */
export function urlBaseTest() {
  const source = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL manquant : impossible de préparer la base de test.");
  const url = new URL(source);
  if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}

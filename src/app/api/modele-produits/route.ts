import { utilisateurCourant } from "@/lib/session";
import { reponseXlsx } from "@/lib/xlsx";
import { modeleImportXlsx } from "@/server/services/import-produits";

export async function GET() {
  const user = await utilisateurCourant();
  if (!user || (user.role !== "ADMIN" && user.role !== "GERANT")) {
    return new Response("Accès refusé", { status: 403 });
  }
  return reponseXlsx(await modeleImportXlsx(), "modele-import-produits.xlsx");
}

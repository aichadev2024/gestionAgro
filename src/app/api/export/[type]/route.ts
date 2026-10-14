import { formatDate } from "@/lib/format";
import { utilisateurCourant } from "@/lib/session";
import { classeurExcel, reponseXlsx } from "@/lib/xlsx";
import { bornes, ventesPourExport, type Periode } from "@/server/services/statistiques";
import { lotsEnStock } from "@/server/services/stocks";

export async function GET(request: Request, ctx: RouteContext<"/api/export/[type]">) {
  const user = await utilisateurCourant();
  if (!user || (user.role !== "ADMIN" && user.role !== "GERANT")) {
    return new Response("Accès refusé", { status: 403 });
  }

  const { type } = await ctx.params;
  const url = new URL(request.url);
  const annee = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const mois = Number(url.searchParams.get("mois"));
  const periode: Periode =
    url.searchParams.get("vue") === "annee" || !(mois >= 1 && mois <= 12)
      ? { vue: "annee", annee }
      : { vue: "mois", annee, mois };
  const { debut, fin } = bornes(periode);
  const suffixe =
    periode.vue === "mois"
      ? `${periode.annee}-${String(periode.mois).padStart(2, "0")}`
      : String(periode.annee);
  const aujourdhui = formatDate(new Date()).replaceAll("/", "-");

  if (type === "ventes") {
    const ventes = await ventesPourExport(debut, fin);
    const fichier = await classeurExcel(
      "Ventes",
      ["Facture", "Date", "Client", "Caissier", "Statut", "Remise (FCFA)", "Total (FCFA)", "Paiements"],
      ventes.map((v) => [
        v.numero,
        formatDate(v.creeLe),
        v.client?.nom ?? "Passage",
        v.caissier.nom,
        v.statut === "VALIDEE" ? "Validée" : "Annulée",
        v.remise,
        v.total,
        v.paiements.map((p) => `${p.mode} ${p.montant}`).join(" + "),
      ]),
    );
    return reponseXlsx(fichier, `ventes-${suffixe}.xlsx`);
  }

  if (type === "stock") {
    const lots = await lotsEnStock();
    const fichier = await classeurExcel(
      "Stock",
      ["Produit", "Code", "Lot", "Dépôt", "Péremption", "Quantité", "Unité", "Prix d'achat (FCFA)"],
      lots.map((l) => [
        l.produit.nom,
        l.produit.code,
        l.numeroLot,
        l.depot.nom,
        l.datePeremption ? formatDate(l.datePeremption) : "",
        l.quantiteRestante.toNumber(),
        l.produit.unite.symbole,
        l.prixAchat,
      ]),
    );
    return reponseXlsx(fichier, `stock-${aujourdhui}.xlsx`);
  }

  return new Response("Export inconnu", { status: 404 });
}

import { genererFacturePdf } from "@/lib/pdf-facture";
import { utilisateurCourant } from "@/lib/session";
import { trouverVente } from "@/server/services/ventes";

const LIBELLE_MODE = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  CREDIT: "Crédit",
} as const;

export async function GET(_: Request, ctx: RouteContext<"/api/factures/[id]">) {
  const user = await utilisateurCourant();
  if (!user || !["ADMIN", "GERANT", "CAISSIER"].includes(user.role)) {
    return new Response("Accès refusé", { status: 403 });
  }
  const { id } = await ctx.params;
  const vente = await trouverVente(id);
  if (!vente) return new Response("Facture introuvable", { status: 404 });

  const pdf = await genererFacturePdf({
    numero: vente.numero,
    date: vente.creeLe,
    statut: vente.statut === "ANNULEE" ? "ANNULEE" : "VALIDEE",
    client: vente.client?.nom ?? "Client de passage",
    caissier: vente.caissier.nom,
    remise: vente.remise,
    total: vente.total,
    lignes: vente.lignes.map((l) => ({
      produit: l.produit.nom,
      quantite: l.quantite.toString(),
      unite: l.produit.unite.symbole,
      prix: l.prixUnitaire,
      montant: l.quantite.mul(l.prixUnitaire).round().toNumber(),
    })),
    paiements: vente.paiements.map((p) => ({ mode: LIBELLE_MODE[p.mode], montant: p.montant })),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${vente.numero}.pdf"`,
    },
  });
}

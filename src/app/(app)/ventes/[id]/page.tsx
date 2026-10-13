import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { annulerVenteAction } from "@/server/actions/ventes";
import { trouverVente } from "@/server/services/ventes";

const LIBELLE_MODE = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  CREDIT: "Crédit",
} as const;

export default async function PageFacture({ params }: PageProps<"/ventes/[id]">) {
  const user = await exigerAccesModule("/ventes");
  const { id } = await params;
  const vente = await trouverVente(id);
  if (!vente) notFound();

  const peutAnnuler =
    vente.statut === "VALIDEE" && (user.role === "ADMIN" || user.role === "GERANT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/ventes" className="text-sm text-gray-500 hover:underline">
          ← Ventes
        </Link>
        <BoutonImprimer />
      </div>

      <article className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8 print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="text-xl font-extrabold text-brand">AgroGestion</div>
            <div className="text-sm text-gray-500">Facture</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-bold">{vente.numero}</div>
            <div className="text-gray-500">{formatDate(vente.creeLe)}</div>
            {vente.statut === "ANNULEE" && (
              <div className="mt-1 font-bold uppercase text-tomate">Annulée</div>
            )}
          </div>
        </header>

        <p className="mt-4 text-sm text-gray-600">
          Client : <strong>{vente.client?.nom ?? "Client de passage"}</strong> · Caissier :{" "}
          {vente.caissier.nom}
        </p>

        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="py-2">Produit</th>
              <th className="py-2 text-right">Qté</th>
              <th className="py-2 text-right">Prix</th>
              <th className="py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {vente.lignes.map((l) => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="py-2">{l.produit.nom}</td>
                <td className="py-2 text-right">
                  {l.quantite.toString()} {l.produit.unite.symbole}
                </td>
                <td className="py-2 text-right">{formatFCFA(l.prixUnitaire)}</td>
                <td className="py-2 text-right">
                  {formatFCFA(l.quantite.mul(l.prixUnitaire).round().toNumber())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-gray-200 pt-3 text-right text-sm">
          {vente.remise > 0 && <div>Remise : −{formatFCFA(vente.remise)}</div>}
          <div className="text-xl font-extrabold text-brand">Total : {formatFCFA(vente.total)}</div>
          {vente.paiements.map((p) => (
            <div key={p.id} className="text-gray-600">
              {LIBELLE_MODE[p.mode]} : {formatFCFA(p.montant)}
            </div>
          ))}
        </div>

        {vente.statut === "ANNULEE" && (
          <p className="mt-4 text-sm text-tomate">Motif d&apos;annulation : {vente.motifAnnulation}</p>
        )}
      </article>

      {peutAnnuler && (
        <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm md:p-6 print:hidden">
          <h2 className="mb-3 text-lg font-bold text-tomate">Annuler la vente</h2>
          <p className="mb-3 text-sm text-gray-500">
            Les quantités retournent dans leurs lots d&apos;origine. La facture reste consultable.
          </p>
          <Formulaire action={annulerVenteAction.bind(null, vente.id)} libelleBouton="Annuler la vente">
            <Champ label="Motif (obligatoire)">
              <input name="motif" required className={classeChamp} />
            </Champ>
          </Formulaire>
        </section>
      )}
    </div>
  );
}

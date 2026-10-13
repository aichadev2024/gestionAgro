import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { annulerProductionAction } from "@/server/actions/production";
import { trouverProduction } from "@/server/services/production";

export default async function PageProductionDetail({ params }: PageProps<"/production/[id]">) {
  const user = await exigerAccesModule("/production");
  const { id } = await params;
  const p = await trouverProduction(id);
  if (!p) notFound();

  const unite = p.recette.produitFini.unite.symbole;
  const rendement = p.quantiteTheorique.isZero()
    ? 0
    : Math.round(p.quantiteObtenue.div(p.quantiteTheorique).mul(100).toNumber());
  const peutAnnuler =
    p.statut === "VALIDEE" && (user.role === "ADMIN" || user.role === "GERANT");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/production" className="text-sm text-gray-500 hover:underline">
          ← Production
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-extrabold text-brand">
          {p.numero}
          {p.statut === "ANNULEE" && <span className="ml-3 text-base text-tomate">Annulée</span>}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {p.recette.nom} · {formatDate(p.creeLe)} · lot {p.lot.numeroLot}
        </p>
        {p.statut === "ANNULEE" && (
          <p className="mt-1 text-sm text-tomate">Motif : {p.motifAnnulation}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Théorique", `${p.quantiteTheorique} ${unite}`],
          ["Obtenu", `${p.quantiteObtenue} ${unite}`],
          ["Rendement", `${rendement} %`],
          ["Coût des matières", formatFCFA(p.coutTotal)],
        ].map(([titre, valeur]) => (
          <div key={titre} className="rounded-2xl border-l-4 border-l-brand bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">{titre}</div>
            <div className="text-xl font-extrabold">{valeur}</div>
          </div>
        ))}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Matières consommées (traçabilité)</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Matière</th>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3 text-right">Quantité</th>
            </tr>
          </thead>
          <tbody>
            {p.consommations.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{c.lot.produit.nom}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.lot.numeroLot}</td>
                <td className="px-4 py-3 text-right">
                  {c.quantite.toString()} {c.lot.produit.unite.symbole}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {peutAnnuler && (
        <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-tomate">Annuler la production</h2>
          <p className="mb-3 text-sm text-gray-500">
            Les matières retournent en stock. Impossible si le produit fini a déjà été vendu.
          </p>
          <Formulaire action={annulerProductionAction.bind(null, p.id)} libelleBouton="Annuler la production">
            <Champ label="Motif (obligatoire)">
              <input name="motif" required className={classeChamp} />
            </Champ>
          </Formulaire>
        </section>
      )}
    </div>
  );
}

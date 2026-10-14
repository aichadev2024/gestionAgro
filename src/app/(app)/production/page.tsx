import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { ProductionForm } from "@/components/production-form";
import { RecetteForm } from "@/components/recette-form";
import { listerProduits } from "@/server/services/catalogue";
import { listerProductions, listerRecettes } from "@/server/services/production";
import { listerDepots } from "@/server/services/stocks";

export default async function PageProduction() {
  await exigerAccesModule("/production");
  const [recettes, productions, produits, depots] = await Promise.all([
    listerRecettes(),
    listerProductions(),
    listerProduits(),
    listerDepots(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Production</h1>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand">Lancer une production</h2>
        {recettes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Créez d&apos;abord une recette ci-dessous (produit fini + matières premières).
          </p>
        ) : (
          <ProductionForm
            depots={depots.map((d) => ({ id: d.id, nom: d.nom }))}
            recettes={recettes.map((r) => ({
              id: r.id,
              nom: r.nom,
              fini: r.produitFini.nom,
              symbole: r.produitFini.unite.symbole,
              quantiteProduite: r.quantiteProduite.toString(),
              perissable: r.produitFini.perissable,
              lignes: r.lignes.map((l) => ({
                nom: l.produit.nom,
                symbole: l.produit.unite.symbole,
                quantite: l.quantite.toString(),
              })),
            }))}
          />
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Productions</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Produit fini</th>
              <th className="px-4 py-3 text-right">Obtenu</th>
              <th className="px-4 py-3 text-right">Rendement</th>
              <th className="px-4 py-3 text-right">Coût matières</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {productions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Aucune production.
                </td>
              </tr>
            )}
            {productions.map((p) => {
              const rendement = p.quantiteTheorique.isZero()
                ? 0
                : Math.round(p.quantiteObtenue.div(p.quantiteTheorique).mul(100).toNumber());
              return (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/production/${p.id}`} className="font-semibold text-brand hover:underline">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(p.creeLe)}</td>
                  <td className="px-4 py-3">{p.recette.produitFini.nom}</td>
                  <td className="px-4 py-3 text-right">
                    {p.quantiteObtenue.toString()} {p.recette.produitFini.unite.symbole}
                  </td>
                  <td className="px-4 py-3 text-right">{rendement} %</td>
                  <td className="px-4 py-3 text-right">{formatFCFA(p.coutTotal)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.statut === "VALIDEE" ? "bg-brand-soft text-brand" : "bg-red-50 text-tomate"
                      }`}
                    >
                      {p.statut === "VALIDEE" ? "Validée" : "Annulée"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Recettes</h2>
        <ul className="mb-5 space-y-1 text-sm">
          {recettes.length === 0 && <li className="text-gray-500">Aucune recette.</li>}
          {recettes.map((r) => (
            <li key={r.id}>
              <strong>{r.nom}</strong> → {r.quantiteProduite.toString()} {r.produitFini.unite.symbole}{" "}
              de {r.produitFini.nom}, avec{" "}
              {r.lignes
                .map((l) => `${l.quantite.toString()} ${l.produit.unite.symbole} ${l.produit.nom}`)
                .join(" + ")}
            </li>
          ))}
        </ul>
        {produits.length < 2 ? (
          <p className="text-sm text-gray-500">Créez au moins deux produits dans le Catalogue.</p>
        ) : (
          <RecetteForm
            produits={produits
              .filter((p) => p.actif)
              .map((p) => ({ id: p.id, nom: p.nom, symbole: p.unite.symbole }))}
          />
        )}
      </section>
    </div>
  );
}

import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import {
  Pagination,
  Recherche,
  lirePage,
  lireTexte,
} from "@/components/recherche-pagination";
import { annulerDepenseAction, creerDepenseAction } from "@/server/actions/depenses";
import { CATEGORIES_DEPENSE, listerDepenses } from "@/server/services/depenses";

const LIBELLE_MODE = { ESPECES: "Espèces", ORANGE_MONEY: "Orange Money", MOOV_MONEY: "Moov Money", CREDIT: "Crédit" } as const;

export default async function PageDepenses({ searchParams }: PageProps<"/depenses">) {
  await exigerAccesModule("/depenses");
  const sp = await searchParams;
  const q = lireTexte(sp.q);
  const page = lirePage(sp.page);
  const [depenses, total] = await listerDepenses(q, page);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Dépenses</h1>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Nouvelle dépense</h2>
        <Formulaire action={creerDepenseAction} libelleBouton="Enregistrer la dépense">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Champ label="Catégorie">
              <select name="categorie" required defaultValue="" className={classeChamp}>
                <option value="" disabled>
                  Choisir…
                </option>
                {CATEGORIES_DEPENSE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Libellé">
              <input name="libelle" required placeholder="Ex. Loyer du magasin" className={classeChamp} />
            </Champ>
            <Champ label="Montant (FCFA)">
              <input name="montant" type="number" min={1} step={1} required className={classeChamp} />
            </Champ>
            <Champ label="Mode de paiement">
              <select name="mode" defaultValue="ESPECES" className={classeChamp}>
                <option value="ESPECES">Espèces</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MOOV_MONEY">Moov Money</option>
              </select>
            </Champ>
            <Champ label="Date">
              <input name="dateDepense" type="date" required defaultValue={aujourdhui} max={aujourdhui} className={classeChamp} />
            </Champ>
          </div>
        </Formulaire>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Recherche action="/depenses" valeur={q} placeholder="Libellé ou catégorie…" />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {depenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucune dépense.
                </td>
              </tr>
            )}
            {depenses.map((d) => (
              <tr key={d.id} className={`border-t border-gray-100 align-top ${d.statut === "ANNULEE" ? "text-gray-400 line-through" : ""}`}>
                <td className="px-4 py-3">{formatDate(d.dateDepense)}</td>
                <td className="px-4 py-3">{d.categorie}</td>
                <td className="px-4 py-3">
                  {d.libelle}
                  {d.statut === "VALIDEE" ? (
                    <details className="mt-1 text-xs no-underline print:hidden">
                      <summary className="cursor-pointer text-tomate">Annuler</summary>
                      <div className="mt-2 max-w-xs">
                        <Formulaire action={annulerDepenseAction.bind(null, d.id)} libelleBouton="Confirmer l'annulation">
                          <Champ label="Motif (obligatoire)">
                            <input name="motif" required className={classeChamp} />
                          </Champ>
                        </Formulaire>
                      </div>
                    </details>
                  ) : (
                    <div className="text-xs no-underline">Motif : {d.motifAnnulation}</div>
                  )}
                </td>
                <td className="px-4 py-3">{LIBELLE_MODE[d.mode]}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatFCFA(d.montant)}</td>
                <td className="px-4 py-3">{d.statut === "VALIDEE" ? "Validée" : "Annulée"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Pagination page={page} total={total} chemin="/depenses" recherche={q} />
    </div>
  );
}

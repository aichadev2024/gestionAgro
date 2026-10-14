import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { StatutAchat } from "@/components/statut-achat";
import { Pagination, Recherche, lirePage, lireTexte } from "@/components/recherche-pagination";
import { creerFournisseur, modifierFournisseurAction } from "@/server/actions/achats";
import {
  dettesFournisseurs,
  listerAchats,
  listerFournisseurs,
  resteAPayer,
} from "@/server/services/achats";

export default async function PageAchats({ searchParams }: PageProps<"/achats">) {
  const user = await exigerAccesModule("/achats");
  const sp = await searchParams;
  const q = lireTexte(sp.q);
  const page = lirePage(sp.page);
  const [[achats, total], fournisseurs, dettes] = await Promise.all([
    listerAchats(q, page),
    listerFournisseurs(),
    dettesFournisseurs(),
  ]);
  const voitPaiements = user.role === "ADMIN" || user.role === "GERANT";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brand">Achats</h1>
        <Link
          href="/achats/nouveau"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90"
        >
          + Nouveau bon de commande
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Recherche action="/achats" valeur={q} placeholder="N° de commande ou fournisseur…" />
        {voitPaiements && (
          <div className="rounded-2xl border-l-4 border-l-tomate bg-white px-5 py-3 shadow-sm">
            <div className="text-xs text-gray-500">Dettes envers les fournisseurs</div>
            <div className="text-xl font-extrabold">{formatFCFA(dettes)}</div>
          </div>
        )}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3 text-right">Total</th>
              {voitPaiements && <th className="px-4 py-3 text-right">Reste à payer</th>}
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {achats.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucun bon de commande pour l&apos;instant.
                </td>
              </tr>
            )}
            {achats.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/achats/${a.id}`} className="font-semibold text-brand hover:underline">
                    {a.numero}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDate(a.creeLe)}</td>
                <td className="px-4 py-3">{a.fournisseur.nom}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(a.total)}</td>
                {voitPaiements && (
                  <td className={`px-4 py-3 text-right font-semibold ${resteAPayer(a) > 0 ? "text-tomate" : "text-brand"}`}>
                    {a.statut === "ANNULE" ? "—" : formatFCFA(resteAPayer(a))}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatutAchat statut={a.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <Pagination page={page} total={total} chemin="/achats" recherche={q} />

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Fournisseurs</h2>
        <div className="mb-4 space-y-2">
          {fournisseurs.length === 0 && <p className="text-sm text-gray-500">Aucun fournisseur.</p>}
          {fournisseurs.map((f) => (
            <details key={f.id} className="rounded-xl bg-brand-soft/50 px-4 py-2">
              <summary className="cursor-pointer text-sm font-medium text-brand">
                {f.nom}
                {f.telephone && <span className="text-gray-500"> · {f.telephone}</span>}
                <span className="text-gray-400"> · {f._count.achats} commande(s)</span>
              </summary>
              <div className="mt-3">
                <Formulaire action={modifierFournisseurAction.bind(null, f.id)} libelleBouton="Enregistrer" vider={false}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Champ label="Nom">
                      <input name="nom" required defaultValue={f.nom} className={classeChamp} />
                    </Champ>
                    <Champ label="Téléphone">
                      <input name="telephone" defaultValue={f.telephone ?? ""} className={classeChamp} />
                    </Champ>
                    <Champ label="Adresse">
                      <input name="adresse" defaultValue={f.adresse ?? ""} className={classeChamp} />
                    </Champ>
                  </div>
                </Formulaire>
              </div>
            </details>
          ))}
        </div>
        <Formulaire action={creerFournisseur} libelleBouton="Ajouter le fournisseur">
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
            <Champ label="Téléphone">
              <input name="telephone" className={classeChamp} />
            </Champ>
            <Champ label="Adresse">
              <input name="adresse" className={classeChamp} />
            </Champ>
          </div>
        </Formulaire>
      </section>
    </div>
  );
}

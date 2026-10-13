import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { StatutAchat } from "@/components/statut-achat";
import { creerFournisseur } from "@/server/actions/achats";
import { listerAchats, listerFournisseurs } from "@/server/services/achats";

export default async function PageAchats() {
  await exigerAccesModule("/achats");
  const [achats, fournisseurs] = await Promise.all([listerAchats(), listerFournisseurs()]);

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

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Numéro</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {achats.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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
                <td className="px-4 py-3">
                  <StatutAchat statut={a.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Fournisseurs</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {fournisseurs.length === 0 && (
            <li className="text-sm text-gray-500">Aucun fournisseur.</li>
          )}
          {fournisseurs.map((f) => (
            <li key={f.id} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
              {f.nom}
              {f.telephone && <span className="text-gray-500"> · {f.telephone}</span>}
            </li>
          ))}
        </ul>
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

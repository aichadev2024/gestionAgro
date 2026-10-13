import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { creerClient } from "@/server/actions/ventes";
import { listerClients, listerVentes } from "@/server/services/ventes";

export default async function PageVentes() {
  const user = await exigerAccesModule("/ventes");
  const [ventes, clients] = await Promise.all([listerVentes(), listerClients()]);
  const peutFixerPlafond = user.role === "ADMIN" || user.role === "GERANT";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brand">Ventes</h1>
        <Link
          href="/ventes/nouvelle"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90"
        >
          + Nouvelle vente
        </Link>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Facture</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Caissier</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ventes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Aucune vente pour l&apos;instant.
                </td>
              </tr>
            )}
            {ventes.map((v) => (
              <tr key={v.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/ventes/${v.id}`} className="font-semibold text-brand hover:underline">
                    {v.numero}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDate(v.creeLe)}</td>
                <td className="px-4 py-3">{v.client?.nom ?? "Passage"}</td>
                <td className="px-4 py-3">{v.caissier.nom}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(v.total)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      v.statut === "VALIDEE" ? "bg-brand-soft text-brand" : "bg-red-50 text-tomate"
                    }`}
                  >
                    {v.statut === "VALIDEE" ? "Validée" : "Annulée"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Clients</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {clients.length === 0 && <li className="text-sm text-gray-500">Aucun client enregistré.</li>}
          {clients.map((c) => (
            <li key={c.id} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
              {c.nom}
              {c.solde > 0 && <span className="text-tomate"> · doit {formatFCFA(c.solde)}</span>}
            </li>
          ))}
        </ul>
        <Formulaire action={creerClient} libelleBouton="Ajouter le client">
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
            <Champ label="Téléphone">
              <input name="telephone" className={classeChamp} />
            </Champ>
            {peutFixerPlafond && (
              <Champ label="Plafond de crédit (FCFA)">
                <input name="plafondCredit" type="number" min={0} step={1} defaultValue={0} className={classeChamp} />
              </Champ>
            )}
          </div>
        </Formulaire>
      </section>
    </div>
  );
}

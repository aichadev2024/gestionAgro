import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Pagination, Recherche, lirePage, lireTexte } from "@/components/recherche-pagination";
import { listerVentes } from "@/server/services/ventes";

export default async function PageVentes({ searchParams }: PageProps<"/ventes">) {
  await exigerAccesModule("/ventes");
  const sp = await searchParams;
  const q = lireTexte(sp.q);
  const page = lirePage(sp.page);
  const [ventes, total] = await listerVentes(q, page);

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

      <Recherche action="/ventes" valeur={q} placeholder="N° de facture ou client…" />

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
      <Pagination page={page} total={total} chemin="/ventes" recherche={q} />

      <p className="text-sm text-gray-500">
        Gestion des clients et remboursements de crédit : <Link href="/clients" className="font-semibold text-brand hover:underline">page Clients</Link>.
      </p>
    </div>
  );
}

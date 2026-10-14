import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { cloturerCaisseAction } from "@/server/actions/clotures";
import { especesAttendues, journee, listerClotures } from "@/server/services/clotures";
import { prisma } from "@/lib/prisma";

export default async function PageCaisse() {
  const user = await exigerAccesModule("/caisse");
  const manager = user.role === "ADMIN" || user.role === "GERANT";
  const { debut } = journee();

  const [calcul, deja, clotures] = await Promise.all([
    especesAttendues(user.id),
    prisma.clotureCaisse.findUnique({
      where: { jour_creeParId: { jour: debut, creeParId: user.id } },
    }),
    listerClotures(manager ? null : user.id),
  ]);
  const noms = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: [...new Set(clotures.map((c) => c.creeParId))] } },
        select: { id: true, nom: true },
      })
    ).map((u) => [u.id, u.nom]),
  );

  const lignes: [string, number, "+" | "−"][] = [
    ["Ventes encaissées en espèces", calcul.ventesEspeces, "+"],
    ["Remboursements de crédit reçus en espèces", calcul.creances, "+"],
    ["Retours remboursés en espèces", calcul.retoursEspeces, "−"],
    ["Dépenses payées en espèces", calcul.depensesEspeces, "−"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Clôture de caisse</h1>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-1 text-lg font-bold text-brand">Aujourd&apos;hui · {formatDate(new Date())}</h2>
        <p className="mb-4 text-sm text-gray-500">Calculé à partir de vos propres opérations de la journée.</p>
        <ul className="space-y-2 text-sm">
          {lignes.map(([titre, montant, signe]) => (
            <li key={titre} className="flex justify-between border-b border-gray-100 pb-2">
              <span>{titre}</span>
              <span className={`font-semibold ${signe === "−" ? "text-tomate" : "text-brand"}`}>
                {signe} {formatFCFA(montant)}
              </span>
            </li>
          ))}
          <li className="flex justify-between pt-1 text-base font-extrabold">
            <span>Espèces attendues dans le tiroir</span>
            <span>{formatFCFA(calcul.attendu)}</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Mobile money encaissé (non compté dans le tiroir) : {formatFCFA(calcul.mobileMoney)}
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        {deja ? (
          <div>
            <h2 className="mb-2 text-lg font-bold text-brand">Caisse déjà clôturée aujourd&apos;hui</h2>
            <p className="text-sm">
              Compté {formatFCFA(deja.compte)} pour {formatFCFA(deja.attendu)} attendus : écart{" "}
              <strong className={deja.ecart === 0 ? "text-brand" : "text-tomate"}>
                {deja.ecart > 0 ? "+" : ""}
                {formatFCFA(deja.ecart)}
              </strong>
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-lg font-bold text-brand">Compter et clôturer</h2>
            <Formulaire action={cloturerCaisseAction} libelleBouton="Clôturer la caisse" vider={false}>
              <Champ label="Espèces réellement comptées dans le tiroir (FCFA)">
                <input name="compte" type="number" min={0} step={1} required className={classeChamp} />
              </Champ>
              <Champ label="Note (explication d'un écart, facultatif)">
                <input name="note" className={classeChamp} />
              </Champ>
            </Formulaire>
          </>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Historique des clôtures</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Jour</th>
              {manager && <th className="px-4 py-3">Caissier</th>}
              <th className="px-4 py-3 text-right">Attendu</th>
              <th className="px-4 py-3 text-right">Compté</th>
              <th className="px-4 py-3 text-right">Écart</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {clotures.length === 0 && (
              <tr>
                <td colSpan={manager ? 6 : 5} className="px-4 py-6 text-center text-gray-500">
                  Aucune clôture.
                </td>
              </tr>
            )}
            {clotures.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{formatDate(c.jour)}</td>
                {manager && <td className="px-4 py-2">{noms.get(c.creeParId) ?? "—"}</td>}
                <td className="px-4 py-2 text-right">{formatFCFA(c.attendu)}</td>
                <td className="px-4 py-2 text-right">{formatFCFA(c.compte)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${c.ecart === 0 ? "text-brand" : "text-tomate"}`}>
                  {c.ecart > 0 ? "+" : ""}
                  {formatFCFA(c.ecart)}
                </td>
                <td className="px-4 py-2 text-gray-600">{c.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

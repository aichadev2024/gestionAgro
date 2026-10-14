import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { encaisserCreanceAction, modifierClientAction } from "@/server/actions/clients";
import { creerClient } from "@/server/actions/ventes";
import { derniersEncaissements, listerClientsAvecSolde } from "@/server/services/clients";

const LIBELLE_MODE = { ESPECES: "Espèces", ORANGE_MONEY: "Orange Money", MOOV_MONEY: "Moov Money", CREDIT: "Crédit" } as const;

export default async function PageClients() {
  const user = await exigerAccesModule("/clients");
  const [clients, encaissements] = await Promise.all([
    listerClientsAvecSolde(),
    derniersEncaissements(),
  ]);
  const peutPlafond = user.role === "ADMIN" || user.role === "GERANT";
  const totalDu = clients.reduce((s, c) => s + c.solde, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brand">Clients</h1>
        <div className="rounded-2xl border-l-4 border-l-yellow-600 bg-white px-5 py-3 shadow-sm">
          <div className="text-xs text-gray-500">Total dû par les clients</div>
          <div className="text-xl font-extrabold">{formatFCFA(totalDu)}</div>
        </div>
      </div>

      <section className="space-y-3">
        {clients.length === 0 && <p className="text-gray-500">Aucun client enregistré.</p>}
        {clients.map((c) => (
          <details key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-semibold">{c.nom}</span>
              {c.telephone && <span className="text-sm text-gray-500">{c.telephone}</span>}
              <span className="ml-auto text-sm">
                {c.solde > 0 ? (
                  <span className="font-bold text-tomate">Doit {formatFCFA(c.solde)}</span>
                ) : (
                  <span className="text-brand">À jour</span>
                )}
                <span className="ml-3 text-gray-400">plafond {formatFCFA(c.plafondCredit)}</span>
              </span>
            </summary>

            <div className="mt-4 grid gap-6 border-t border-gray-100 pt-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-bold text-brand">Encaisser un remboursement</h3>
                {c.solde === 0 ? (
                  <p className="text-sm text-gray-500">Ce client ne doit rien.</p>
                ) : (
                  <Formulaire action={encaisserCreanceAction.bind(null, c.id)} libelleBouton="Encaisser">
                    <div className="grid grid-cols-2 gap-3">
                      <Champ label={`Montant (max ${c.solde})`}>
                        <input name="montant" type="number" min={1} max={c.solde} step={1} defaultValue={c.solde} required className={classeChamp} />
                      </Champ>
                      <Champ label="Mode">
                        <select name="mode" className={classeChamp} defaultValue="ESPECES">
                          <option value="ESPECES">Espèces</option>
                          <option value="ORANGE_MONEY">Orange Money</option>
                          <option value="MOOV_MONEY">Moov Money</option>
                        </select>
                      </Champ>
                    </div>
                    <Champ label="Note (facultatif)">
                      <input name="note" className={classeChamp} />
                    </Champ>
                  </Formulaire>
                )}
                {c.encaissements.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-gray-500">
                    {c.encaissements.map((e) => (
                      <li key={e.id}>
                        {formatDate(e.creeLe)} · {formatFCFA(e.montant)} · {LIBELLE_MODE[e.mode]}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-bold text-brand">Modifier la fiche</h3>
                <Formulaire action={modifierClientAction.bind(null, c.id)} libelleBouton="Enregistrer" vider={false}>
                  <Champ label="Nom">
                    <input name="nom" required defaultValue={c.nom} className={classeChamp} />
                  </Champ>
                  <Champ label="Téléphone">
                    <input name="telephone" defaultValue={c.telephone ?? ""} className={classeChamp} />
                  </Champ>
                  {peutPlafond && (
                    <Champ label="Plafond de crédit (FCFA)">
                      <input name="plafondCredit" type="number" min={0} step={1} defaultValue={c.plafondCredit} className={classeChamp} />
                    </Champ>
                  )}
                </Formulaire>
              </div>
            </div>
          </details>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Nouveau client</h2>
        <Formulaire action={creerClient} libelleBouton="Ajouter le client">
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
            <Champ label="Téléphone">
              <input name="telephone" className={classeChamp} />
            </Champ>
            {peutPlafond && (
              <Champ label="Plafond de crédit (FCFA)">
                <input name="plafondCredit" type="number" min={0} step={1} defaultValue={0} className={classeChamp} />
              </Champ>
            )}
          </div>
        </Formulaire>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Derniers remboursements encaissés</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {encaissements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Aucun remboursement encaissé.
                </td>
              </tr>
            )}
            {encaissements.map((e) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{formatDate(e.creeLe)}</td>
                <td className="px-4 py-2">{e.client.nom}</td>
                <td className="px-4 py-2">{LIBELLE_MODE[e.mode]}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatFCFA(e.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

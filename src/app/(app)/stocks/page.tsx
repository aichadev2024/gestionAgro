import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import {
  creerDepot,
  enregistrerInventaire,
  enregistrerPerte,
  enregistrerTransfert,
} from "@/server/actions/stocks";
import {
  derniersMouvements,
  etatStock,
  listerDepots,
  lotsEnStock,
} from "@/server/services/stocks";

const LIBELLE_MOUVEMENT: Record<string, string> = {
  RECEPTION: "Réception",
  VENTE: "Vente",
  ANNULATION_VENTE: "Annulation vente",
  PERTE: "Perte",
  TRANSFERT_ENTREE: "Transfert (entrée)",
  TRANSFERT_SORTIE: "Transfert (sortie)",
  INVENTAIRE: "Inventaire",
  PRODUCTION_ENTREE: "Production (entrée)",
  PRODUCTION_SORTIE: "Production (sortie)",
  AJUSTEMENT: "Ajustement",
};

function Alerte({ titre, valeur, classe }: { titre: string; valeur: number; classe: string }) {
  return (
    <div className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${classe}`}>
      <div className="text-sm text-gray-500">{titre}</div>
      <div className="text-3xl font-extrabold text-gray-900">{valeur}</div>
    </div>
  );
}

export default async function PageStocks() {
  const user = await exigerAccesModule("/stocks");
  const [etat, lots, depots, mouvements] = await Promise.all([
    etatStock(),
    lotsEnStock(),
    listerDepots(),
    derniersMouvements(),
  ]);
  const peutInventorier = user.role === "ADMIN" || user.role === "GERANT";
  const nbStockBas = etat.parProduit.filter((p) => p.stockBas).length;

  const optionsLots = lots.map((l) => (
    <option key={l.id} value={l.id}>
      {l.produit.nom} — lot {l.numeroLot} ({l.depot.nom}) — {l.quantiteRestante.toString()}{" "}
      {l.produit.unite.symbole}
    </option>
  ));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Stocks</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Alerte titre="Produits en stock bas" valeur={nbStockBas} classe="border-l-yellow-500" />
        <Alerte titre="Lots périmant sous 30 j" valeur={etat.bientot.length} classe="border-l-accent" />
        <Alerte titre="Lots périmés" valeur={etat.perimes.length} classe="border-l-tomate" />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3 text-right">Stock total</th>
              <th className="px-4 py-3">Lots (péremption la plus proche d&apos;abord)</th>
            </tr>
          </thead>
          <tbody>
            {etat.parProduit.map(({ produit, total, lots: mesLots, stockBas }) => (
              <tr key={produit.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-3 font-semibold">
                  {produit.nom}
                  {stockBas && (
                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      Stock bas
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {total.toString()} {produit.unite.symbole}
                </td>
                <td className="px-4 py-3">
                  {mesLots.length === 0 && <span className="text-gray-400">Aucun lot</span>}
                  <ul className="space-y-1">
                    {mesLots.map((l) => {
                      const perime = l.datePeremption && l.datePeremption < etat.aujourdhui;
                      return (
                        <li key={l.id} className="text-xs">
                          <span className="font-mono">{l.numeroLot}</span> · {l.depot.nom} ·{" "}
                          {l.quantiteRestante.toString()} {produit.unite.symbole} ·{" "}
                          <span className={perime ? "font-bold text-tomate" : "text-gray-500"}>
                            {l.datePeremption ? formatDate(l.datePeremption) : "sans péremption"}
                            {perime && " (périmé)"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {lots.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-brand">Déclarer une perte</h2>
            <Formulaire action={enregistrerPerte} libelleBouton="Enregistrer la perte">
              <Champ label="Lot">
                <select name="lotId" required className={classeChamp} defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {optionsLots}
                </select>
              </Champ>
              <Champ label="Quantité perdue">
                <input name="quantite" inputMode="decimal" required className={classeChamp} />
              </Champ>
              <Champ label="Motif (casse, vol, péremption…)">
                <input name="motif" required className={classeChamp} />
              </Champ>
            </Formulaire>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-brand">Transférer vers un dépôt</h2>
            <Formulaire action={enregistrerTransfert} libelleBouton="Transférer">
              <Champ label="Lot">
                <select name="lotId" required className={classeChamp} defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {optionsLots}
                </select>
              </Champ>
              <Champ label="Quantité">
                <input name="quantite" inputMode="decimal" required className={classeChamp} />
              </Champ>
              <Champ label="Dépôt de destination">
                <select name="depotId" required className={classeChamp} defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            </Formulaire>
          </section>

          {peutInventorier && (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-brand">Inventaire (comptage)</h2>
              <Formulaire action={enregistrerInventaire} libelleBouton="Ajuster le stock">
                <Champ label="Lot">
                  <select name="lotId" required className={classeChamp} defaultValue="">
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {optionsLots}
                  </select>
                </Champ>
                <Champ label="Quantité comptée">
                  <input name="quantite" inputMode="decimal" required className={classeChamp} />
                </Champ>
                <Champ label="Cause de l'écart">
                  <input name="motif" className={classeChamp} />
                </Champ>
              </Formulaire>
            </section>
          )}
        </div>
      )}

      {(user.role === "ADMIN" || user.role === "GERANT") && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-brand">Dépôts</h2>
          <ul className="mb-4 flex flex-wrap gap-2">
            {depots.map((d) => (
              <li key={d.id} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand">
                {d.nom}
              </li>
            ))}
          </ul>
          <Formulaire action={creerDepot} libelleBouton="Ajouter le dépôt">
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ label="Nom">
                <input name="nom" required className={classeChamp} />
              </Champ>
              <Champ label="Adresse">
                <input name="adresse" className={classeChamp} />
              </Champ>
            </div>
          </Formulaire>
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Derniers mouvements</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Produit / lot</th>
              <th className="px-4 py-3 text-right">Quantité</th>
              <th className="px-4 py-3">Référence / motif</th>
            </tr>
          </thead>
          <tbody>
            {mouvements.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Aucun mouvement.
                </td>
              </tr>
            )}
            {mouvements.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{formatDate(m.creeLe)}</td>
                <td className="px-4 py-2">{LIBELLE_MOUVEMENT[m.type] ?? m.type}</td>
                <td className="px-4 py-2">
                  {m.lot.produit.nom} <span className="font-mono text-xs">· {m.lot.numeroLot}</span>
                </td>
                <td
                  className={`px-4 py-2 text-right font-semibold ${
                    m.quantite.isNegative() ? "text-tomate" : "text-brand"
                  }`}
                >
                  {m.quantite.isNegative() ? "" : "+"}
                  {m.quantite.toString()} {m.lot.produit.unite.symbole}
                </td>
                <td className="px-4 py-2 text-gray-600">{m.reference ?? m.motif ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

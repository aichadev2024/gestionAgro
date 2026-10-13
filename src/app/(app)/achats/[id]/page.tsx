import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { StatutAchat } from "@/components/statut-achat";
import { annulerCommande, receptionnerCommande } from "@/server/actions/achats";
import { trouverAchat } from "@/server/services/achats";

export default async function PageAchat({ params }: PageProps<"/achats/[id]">) {
  const user = await exigerAccesModule("/achats");
  const { id } = await params;
  const achat = await trouverAchat(id);
  if (!achat) notFound();

  const peutRecevoir = achat.statut === "COMMANDE" || achat.statut === "RECU_PARTIEL";
  const peutAnnuler =
    achat.statut === "COMMANDE" && (user.role === "ADMIN" || user.role === "GERANT");
  const lignesARecevoir = achat.lignes.filter((l) => l.quantiteRecue.lt(l.quantite));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/achats" className="text-sm text-gray-500 hover:underline">
          ← Achats
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-extrabold text-brand">{achat.numero}</h1>
          <StatutAchat statut={achat.statut} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {achat.fournisseur.nom} · {formatDate(achat.creeLe)} · {formatFCFA(achat.total)}
        </p>
        {achat.statut === "ANNULE" && (
          <p className="mt-2 text-sm text-tomate">Motif d&apos;annulation : {achat.motifAnnulation}</p>
        )}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3 text-right">Commandé</th>
              <th className="px-4 py-3 text-right">Reçu</th>
              <th className="px-4 py-3 text-right">Prix unitaire</th>
            </tr>
          </thead>
          <tbody>
            {achat.lignes.map((l) => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold">{l.produit.nom}</td>
                <td className="px-4 py-3 text-right">
                  {l.quantite.toString()} {l.produit.unite.symbole}
                </td>
                <td className="px-4 py-3 text-right">
                  {l.quantiteRecue.toString()} {l.produit.unite.symbole}
                </td>
                <td className="px-4 py-3 text-right">{formatFCFA(l.prixUnitaire)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {peutRecevoir && lignesARecevoir.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-bold text-brand">Réception de marchandise</h2>
          <p className="mb-4 text-sm text-gray-500">
            Indiquez ce qui est arrivé. Chaque ligne reçue crée un lot en stock. Laissez 0 pour
            une ligne non livrée.
          </p>
          <Formulaire
            action={receptionnerCommande.bind(null, achat.id)}
            libelleBouton="Valider la réception"
          >
            <div className="space-y-3">
              {lignesARecevoir.map((l) => (
                <div
                  key={l.id}
                  className="grid items-end gap-3 rounded-xl bg-brand-soft/50 p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr]"
                >
                  <input type="hidden" name="ligneId" value={l.id} />
                  <div className="text-sm">
                    <div className="font-semibold">{l.produit.nom}</div>
                    <div className="text-gray-500">
                      Reste : {l.quantite.sub(l.quantiteRecue).toString()} {l.produit.unite.symbole}
                    </div>
                  </div>
                  <Champ label="Quantité reçue">
                    <input
                      name={`quantite_${l.id}`}
                      inputMode="decimal"
                      defaultValue="0"
                      className={classeChamp}
                    />
                  </Champ>
                  <Champ label="N° de lot">
                    <input name={`lot_${l.id}`} className={classeChamp} />
                  </Champ>
                  <Champ label={l.produit.perissable ? "Péremption" : "Péremption (facultatif)"}>
                    <input name={`peremption_${l.id}`} type="date" className={classeChamp} />
                  </Champ>
                </div>
              ))}
            </div>
          </Formulaire>
        </section>
      )}

      {peutAnnuler && (
        <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-tomate">Annuler la commande</h2>
          <Formulaire action={annulerCommande.bind(null, achat.id)} libelleBouton="Annuler la commande">
            <Champ label="Motif (obligatoire)">
              <input name="motif" required className={classeChamp} />
            </Champ>
          </Formulaire>
        </section>
      )}
    </div>
  );
}

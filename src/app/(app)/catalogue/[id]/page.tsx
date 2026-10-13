import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { ProduitForm } from "@/components/produit-form";
import {
  ajouterConditionnement,
  basculerActifProduit,
  modifierProduit,
  supprimerConditionnement,
} from "@/server/actions/catalogue";
import { listerCategories, listerUnites, trouverProduit } from "@/server/services/catalogue";

export default async function PageProduit({ params }: PageProps<"/catalogue/[id]">) {
  const user = await exigerAccesModule("/catalogue");
  const { id } = await params;
  const [produit, categories, unites] = await Promise.all([
    trouverProduit(id),
    listerCategories(),
    listerUnites(),
  ]);
  if (!produit) notFound();
  const voitPrix = user.role === "ADMIN" || user.role === "GERANT";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalogue" className="text-sm text-gray-500 hover:underline">
          ← Catalogue
        </Link>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-brand">{produit.nom}</h1>
          <form action={basculerActifProduit.bind(null, produit.id)}>
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold uppercase shadow-sm hover:bg-gray-50">
              {produit.actif ? "Désactiver" : "Réactiver"}
            </button>
          </form>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand">Informations</h2>
        <ProduitForm
          action={modifierProduit.bind(null, produit.id)}
          categories={categories}
          unites={unites}
          prixModifiables={voitPrix}
          libelleBouton="Enregistrer"
          vider={false}
          defaut={{
            code: produit.code,
            nom: produit.nom,
            categorieId: produit.categorieId,
            uniteId: produit.uniteId,
            prixAchat: produit.prixAchat,
            prixVente: produit.prixVente,
            seuilAlerte: produit.seuilAlerte.toString(),
            perissable: produit.perissable,
          }}
        />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-1 text-lg font-bold text-brand">Conditionnements</h2>
        <p className="mb-4 text-sm text-gray-500">
          Ex. « Carton de 12 » = 12 {produit.unite.symbole}.
        </p>
        <ul className="mb-4 divide-y divide-gray-100">
          {produit.conditionnements.length === 0 && (
            <li className="py-2 text-sm text-gray-500">Aucun conditionnement.</li>
          )}
          {produit.conditionnements.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <strong>{c.nom}</strong> — {c.quantite.toString()} {produit.unite.symbole}
                {c.prixVente != null && ` — ${formatFCFA(c.prixVente)}`}
              </span>
              <form action={supprimerConditionnement.bind(null, produit.id, c.id)}>
                <button className="text-xs text-red-600 hover:underline">Retirer</button>
              </form>
            </li>
          ))}
        </ul>
        <Formulaire
          action={ajouterConditionnement.bind(null, produit.id)}
          libelleBouton="Ajouter"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
            <Champ label={`Quantité (${produit.unite.symbole})`}>
              <input name="quantite" type="number" step="0.001" min="0.001" required className={classeChamp} />
            </Champ>
            <Champ label="Prix de vente (optionnel)">
              <input name="prixVente" type="number" min={0} step={1} className={classeChamp} />
            </Champ>
          </div>
        </Formulaire>
      </section>
    </div>
  );
}

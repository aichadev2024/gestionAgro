import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatFCFA } from "@/lib/format";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { ProduitForm } from "@/components/produit-form";
import { creerCategorie, creerProduit, creerUnite } from "@/server/actions/catalogue";
import { listerCategories, listerProduits, listerUnites } from "@/server/services/catalogue";

export default async function PageCatalogue() {
  const user = await exigerAccesModule("/catalogue");
  const [produits, categories, unites] = await Promise.all([
    listerProduits(),
    listerCategories(),
    listerUnites(),
  ]);
  const voitPrix = user.role === "ADMIN" || user.role === "GERANT";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Catalogue</h1>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Unité</th>
              {voitPrix && <th className="px-4 py-3 text-right">Prix d&apos;achat</th>}
              <th className="px-4 py-3 text-right">Prix de vente</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {produits.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Aucun produit. Ajoutez le premier ci-dessous.
                </td>
              </tr>
            )}
            {produits.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/catalogue/${p.id}`} className="text-brand hover:underline">
                    {p.nom}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.categorie.nom}</td>
                <td className="px-4 py-3">{p.unite.symbole}</td>
                {voitPrix && (
                  <td className="px-4 py-3 text-right">{formatFCFA(p.prixAchat)}</td>
                )}
                <td className="px-4 py-3 text-right">{formatFCFA(p.prixVente)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      p.actif ? "bg-brand-soft text-brand" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.actif ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand">Nouveau produit</h2>
        <ProduitForm
          action={creerProduit}
          categories={categories}
          unites={unites}
          prixModifiables={voitPrix}
          libelleBouton="Créer le produit"
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-brand">Catégories</h2>
          <ul className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                {c.nom} <span className="text-gray-400">({c._count.produits})</span>
              </li>
            ))}
          </ul>
          <Formulaire action={creerCategorie} libelleBouton="Ajouter la catégorie">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
          </Formulaire>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-bold text-brand">Unités</h2>
          <ul className="mb-4 flex flex-wrap gap-2">
            {unites.map((u) => (
              <li key={u.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                {u.nom} ({u.symbole}){" "}
                <span className="text-gray-400">({u._count.produits})</span>
              </li>
            ))}
          </ul>
          <Formulaire action={creerUnite} libelleBouton="Ajouter l'unité">
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Nom">
                <input name="nom" required className={classeChamp} />
              </Champ>
              <Champ label="Symbole">
                <input name="symbole" required className={classeChamp} />
              </Champ>
            </div>
          </Formulaire>
        </section>
      </div>
    </div>
  );
}

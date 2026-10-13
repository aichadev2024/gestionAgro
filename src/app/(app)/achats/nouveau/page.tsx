import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { CommandeForm } from "@/components/commande-form";
import { listerProduits } from "@/server/services/catalogue";
import { listerFournisseurs } from "@/server/services/achats";

export default async function PageNouvelAchat() {
  await exigerAccesModule("/achats");
  const [fournisseurs, produits] = await Promise.all([listerFournisseurs(), listerProduits()]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/achats" className="text-sm text-gray-500 hover:underline">
          ← Achats
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand">Nouveau bon de commande</h1>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        {fournisseurs.length === 0 || produits.length === 0 ? (
          <p className="text-gray-600">
            Il faut au moins un fournisseur (page Achats) et un produit (page Catalogue) pour créer
            une commande.
          </p>
        ) : (
          <CommandeForm
            fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom }))}
            produits={produits
              .filter((p) => p.actif)
              .map((p) => ({
                id: p.id,
                nom: p.nom,
                symbole: p.unite.symbole,
                prixAchat: p.prixAchat,
              }))}
          />
        )}
      </section>
    </div>
  );
}

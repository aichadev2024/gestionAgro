import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { ImportProduitsForm } from "@/components/import-produits-form";
import { COLONNES_MODELE } from "@/server/services/import-produits";

export default async function PageImportProduits() {
  const user = await exigerAccesModule("/catalogue");
  if (user.role !== "ADMIN" && user.role !== "GERANT") redirect("/catalogue");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalogue" className="text-sm text-gray-500 hover:underline">
          ← Catalogue
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand">Importer des produits</h1>
      </div>

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-brand">1. Préparer le fichier</h2>
        <p className="text-sm text-gray-600">
          Téléchargez le modèle Excel, remplissez une ligne par produit, puis enregistrez-le en{" "}
          <strong>.xlsx</strong> ou <strong>.csv</strong>.
        </p>
        {/* Téléchargement de fichier : un lien classique est voulu. */}
        <a
          href="/api/modele-produits"
          className="inline-block rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          Télécharger le modèle Excel
        </a>
        <p className="text-xs text-gray-500">
          Colonnes : {COLONNES_MODELE.join(", ")}. Les catégories inconnues sont créées
          automatiquement ; les unités doivent déjà exister. L&apos;import est « tout ou rien » : une
          erreur sur une ligne annule tout et vous indique laquelle.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">2. Envoyer le fichier</h2>
        <ImportProduitsForm />
      </section>
    </div>
  );
}

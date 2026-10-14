"use client";

import { useActionState } from "react";
import { importerProduitsAction } from "@/server/actions/import-produits";

export function ImportProduitsForm() {
  const [etat, envoyer, enCours] = useActionState(importerProduitsAction, undefined);

  return (
    <form action={envoyer} className="space-y-4">
      <input
        type="file"
        name="fichier"
        accept=".xlsx,.csv"
        required
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand"
      />
      <button
        disabled={enCours}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {enCours ? "Import en cours…" : "Importer"}
      </button>

      {etat?.erreur && <p className="text-sm text-tomate">{etat.erreur}</p>}

      {etat && !etat.erreur && etat.crees! > 0 && (
        <p className="rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">
          {etat.crees} produit(s) importé(s) avec succès.
        </p>
      )}

      {etat?.erreurs && etat.erreurs.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm">
          <p className="mb-2 font-semibold text-tomate">
            Aucun produit importé : corrigez le fichier puis recommencez.
          </p>
          <ul className="list-inside list-disc space-y-1 text-gray-700">
            {etat.erreurs.slice(0, 50).map((e, i) => (
              <li key={i}>{e.ligne > 0 ? `Ligne ${e.ligne} : ` : ""}{e.message}</li>
            ))}
          </ul>
          {etat.erreurs.length > 50 && (
            <p className="mt-2 text-xs text-gray-500">… et {etat.erreurs.length - 50} autres erreurs.</p>
          )}
        </div>
      )}
    </form>
  );
}

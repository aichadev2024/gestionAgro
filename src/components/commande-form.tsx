"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { classeChamp } from "@/components/formulaire";
import { creerCommande } from "@/server/actions/achats";

type Fournisseur = { id: string; nom: string };
type ProduitOption = { id: string; nom: string; symbole: string; prixAchat: number };
type Ligne = { cle: number; produitId: string; quantite: string; prixUnitaire: string };

let compteur = 1;

export function CommandeForm({
  fournisseurs,
  produits,
}: {
  fournisseurs: Fournisseur[];
  produits: ProduitOption[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [fournisseurId, setFournisseurId] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([
    { cle: 0, produitId: "", quantite: "", prixUnitaire: "" },
  ]);
  const [erreur, setErreur] = useState<string>();

  const maj = (cle: number, patch: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));

  const choisirProduit = (cle: number, produitId: string) => {
    const p = produits.find((x) => x.id === produitId);
    maj(cle, { produitId, prixUnitaire: p ? String(p.prixAchat) : "" });
  };

  const total = lignes.reduce(
    (s, l) => s + Math.round((Number(l.quantite.replace(",", ".")) || 0) * (Number(l.prixUnitaire) || 0)),
    0,
  );

  function envoyer() {
    setErreur(undefined);
    demarrer(async () => {
      const res = await creerCommande({
        fournisseurId,
        lignes: lignes.map((l) => ({
          produitId: l.produitId,
          quantite: l.quantite.trim(),
          prixUnitaire: Number(l.prixUnitaire),
        })),
      });
      if (res.erreur) setErreur(res.erreur);
      else if (res.id) router.push(`/achats/${res.id}`);
    });
  }

  return (
    <div className="space-y-5">
      <label className="block text-sm font-medium text-gray-700">
        Fournisseur
        <select
          value={fournisseurId}
          onChange={(e) => setFournisseurId(e.target.value)}
          className={classeChamp}
        >
          <option value="">Choisir…</option>
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        {lignes.map((l) => {
          const p = produits.find((x) => x.id === l.produitId);
          return (
            <div
              key={l.cle}
              className="grid items-end gap-3 rounded-xl bg-brand-soft/50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <label className="text-sm font-medium text-gray-700">
                Produit
                <select
                  value={l.produitId}
                  onChange={(e) => choisirProduit(l.cle, e.target.value)}
                  className={classeChamp}
                >
                  <option value="">Choisir…</option>
                  {produits.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Quantité {p && `(${p.symbole})`}
                <input
                  inputMode="decimal"
                  value={l.quantite}
                  onChange={(e) => maj(l.cle, { quantite: e.target.value })}
                  className={classeChamp}
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Prix unitaire (FCFA)
                <input
                  inputMode="numeric"
                  value={l.prixUnitaire}
                  onChange={(e) => maj(l.cle, { prixUnitaire: e.target.value })}
                  className={classeChamp}
                />
              </label>
              <button
                type="button"
                disabled={lignes.length === 1}
                onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                className="mb-1 text-sm text-tomate disabled:opacity-30"
              >
                Retirer
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            setLignes((ls) => [...ls, { cle: compteur++, produitId: "", quantite: "", prixUnitaire: "" }])
          }
          className="text-sm font-semibold text-brand hover:underline"
        >
          + Ajouter une ligne
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div className="text-lg font-extrabold text-brand">
          Total : {new Intl.NumberFormat("fr-FR").format(total).replace(/[  ]/g, " ")} FCFA
        </div>
        <button
          type="button"
          onClick={envoyer}
          disabled={enCours}
          className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {enCours ? "Enregistrement…" : "Créer le bon de commande"}
        </button>
      </div>
      {erreur && <p className="text-sm text-tomate">{erreur}</p>}
    </div>
  );
}

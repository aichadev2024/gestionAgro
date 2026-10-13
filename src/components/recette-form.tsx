"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { classeChamp } from "@/components/formulaire";
import { creerRecetteAction } from "@/server/actions/production";

type Produit = { id: string; nom: string; symbole: string };
type Ligne = { cle: number; produitId: string; quantite: string };

let compteur = 1;

export function RecetteForm({ produits }: { produits: Produit[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [nom, setNom] = useState("");
  const [produitFiniId, setProduitFiniId] = useState("");
  const [quantiteProduite, setQuantiteProduite] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([{ cle: 0, produitId: "", quantite: "" }]);
  const [message, setMessage] = useState<{ erreur?: string; ok?: boolean }>();

  const fini = produits.find((p) => p.id === produitFiniId);
  const maj = (cle: number, patch: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));

  function envoyer() {
    setMessage(undefined);
    demarrer(async () => {
      const res = await creerRecetteAction({
        nom,
        produitFiniId,
        quantiteProduite: quantiteProduite.trim(),
        lignes: lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite.trim() })),
      });
      setMessage(res);
      if (res.ok) {
        setNom("");
        setProduitFiniId("");
        setQuantiteProduite("");
        setLignes([{ cle: compteur++, produitId: "", quantite: "" }]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-gray-700">
          Nom de la recette
          <input value={nom} onChange={(e) => setNom(e.target.value)} className={classeChamp} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Produit fini
          <select
            value={produitFiniId}
            onChange={(e) => setProduitFiniId(e.target.value)}
            className={classeChamp}
          >
            <option value="">Choisir…</option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Quantité obtenue pour 1 lot {fini && `(${fini.symbole})`}
          <input
            inputMode="decimal"
            value={quantiteProduite}
            onChange={(e) => setQuantiteProduite(e.target.value)}
            className={classeChamp}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-brand">Matières premières pour 1 lot</div>
        {lignes.map((l) => {
          const p = produits.find((x) => x.id === l.produitId);
          return (
            <div key={l.cle} className="grid items-end gap-3 rounded-xl bg-brand-soft/50 p-3 sm:grid-cols-[2fr_1fr_auto]">
              <label className="text-sm font-medium text-gray-700">
                Matière
                <select
                  value={l.produitId}
                  onChange={(e) => maj(l.cle, { produitId: e.target.value })}
                  className={classeChamp}
                >
                  <option value="">Choisir…</option>
                  {produits
                    .filter((x) => x.id !== produitFiniId)
                    .map((x) => (
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
          onClick={() => setLignes((ls) => [...ls, { cle: compteur++, produitId: "", quantite: "" }])}
          className="text-sm font-semibold text-brand hover:underline"
        >
          + Ajouter une matière
        </button>
      </div>

      {message?.erreur && <p className="text-sm text-tomate">{message.erreur}</p>}
      {message?.ok && <p className="text-sm text-brand">Recette enregistrée.</p>}
      <button
        type="button"
        onClick={envoyer}
        disabled={enCours}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer la recette"}
      </button>
    </div>
  );
}

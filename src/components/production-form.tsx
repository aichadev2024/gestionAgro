"use client";

import { useState } from "react";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { lancerProduction } from "@/server/actions/production";

type Recette = {
  id: string;
  nom: string;
  fini: string;
  symbole: string;
  quantiteProduite: string;
  perissable: boolean;
  lignes: { nom: string; symbole: string; quantite: string }[];
};

const nombre = (s: string) => Number(s.replace(",", ".")) || 0;
const arrondi = (n: number) => String(Math.round(n * 1000) / 1000);

export function ProductionForm({ recettes }: { recettes: Recette[] }) {
  const [recetteId, setRecetteId] = useState("");
  const [mult, setMult] = useState("1");
  const [obtenue, setObtenue] = useState<string>();

  const recette = recettes.find((r) => r.id === recetteId);
  const theorique = recette ? nombre(recette.quantiteProduite) * nombre(mult) : 0;
  const quantiteObtenue = obtenue ?? (theorique ? arrondi(theorique) : "");
  const rendement = theorique > 0 ? Math.round((nombre(quantiteObtenue) / theorique) * 100) : null;

  return (
    <Formulaire action={lancerProduction} libelleBouton="Lancer la production" vider={false}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Recette">
          <select
            name="recetteId"
            required
            value={recetteId}
            onChange={(e) => {
              setRecetteId(e.target.value);
              setObtenue(undefined);
            }}
            className={classeChamp}
          >
            <option value="">Choisir…</option>
            {recettes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom} → {r.fini}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Nombre de lots de recette">
          <input
            name="multiplicateur"
            inputMode="decimal"
            value={mult}
            onChange={(e) => {
              setMult(e.target.value);
              setObtenue(undefined);
            }}
            className={classeChamp}
          />
        </Champ>
      </div>

      {recette && (
        <div className="rounded-xl bg-brand-soft/60 p-3 text-sm">
          <div className="mb-1 font-semibold text-brand">Matières à consommer (en FEFO)</div>
          <ul className="list-inside list-disc text-gray-700">
            {recette.lignes.map((l) => (
              <li key={l.nom}>
                {l.nom} : {arrondi(nombre(l.quantite) * nombre(mult))} {l.symbole}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-gray-600">
            Production théorique : {arrondi(theorique)} {recette.symbole}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Champ label={`Quantité réellement obtenue${recette ? ` (${recette.symbole})` : ""}`}>
          <input
            name="quantiteObtenue"
            inputMode="decimal"
            required
            value={quantiteObtenue}
            onChange={(e) => setObtenue(e.target.value)}
            className={classeChamp}
          />
        </Champ>
        <Champ label="N° de lot produit">
          <input name="numeroLot" required className={classeChamp} />
        </Champ>
        <Champ label={recette?.perissable ? "Péremption" : "Péremption (facultatif)"}>
          <input name="datePeremption" type="date" className={classeChamp} />
        </Champ>
      </div>
      {rendement !== null && (
        <p className={`text-sm font-semibold ${rendement < 90 ? "text-tomate" : "text-brand"}`}>
          Rendement : {rendement} %
        </p>
      )}
    </Formulaire>
  );
}

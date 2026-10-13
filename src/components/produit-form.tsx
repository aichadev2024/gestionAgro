"use client";

import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import type { EtatFormulaire } from "@/lib/erreurs";

type Option = { id: string; nom: string };

export type ProduitDefaut = {
  code: string;
  nom: string;
  categorieId: string;
  uniteId: string;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: string;
  perissable: boolean;
};

export function ProduitForm({
  action,
  categories,
  unites,
  defaut,
  prixModifiables,
  libelleBouton,
  vider,
}: {
  action: (etat: EtatFormulaire, fd: FormData) => Promise<EtatFormulaire>;
  categories: Option[];
  unites: Option[];
  defaut?: ProduitDefaut;
  prixModifiables: boolean;
  libelleBouton: string;
  vider?: boolean;
}) {
  return (
    <Formulaire action={action} libelleBouton={libelleBouton} vider={vider}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Code">
          <input name="code" required defaultValue={defaut?.code} className={classeChamp} />
        </Champ>
        <Champ label="Nom">
          <input name="nom" required defaultValue={defaut?.nom} className={classeChamp} />
        </Champ>
        <Champ label="Catégorie">
          <select
            name="categorieId"
            required
            defaultValue={defaut?.categorieId ?? ""}
            className={classeChamp}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Unité">
          <select
            name="uniteId"
            required
            defaultValue={defaut?.uniteId ?? ""}
            className={classeChamp}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {unites.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Prix d'achat (FCFA)">
          <input
            name="prixAchat"
            type="number"
            min={0}
            step={1}
            defaultValue={defaut?.prixAchat ?? 0}
            readOnly={!prixModifiables}
            className={classeChamp}
          />
        </Champ>
        <Champ label="Prix de vente (FCFA)">
          <input
            name="prixVente"
            type="number"
            min={0}
            step={1}
            defaultValue={defaut?.prixVente ?? 0}
            readOnly={!prixModifiables}
            className={classeChamp}
          />
        </Champ>
        <Champ label="Seuil d'alerte (stock bas)">
          <input
            name="seuilAlerte"
            type="number"
            min={0}
            step="0.001"
            defaultValue={defaut?.seuilAlerte ?? "0"}
            className={classeChamp}
          />
        </Champ>
        <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700">
          <input
            name="perissable"
            type="checkbox"
            defaultChecked={defaut?.perissable ?? true}
            className="h-4 w-4"
          />
          Produit périssable (date de péremption)
        </label>
      </div>
    </Formulaire>
  );
}

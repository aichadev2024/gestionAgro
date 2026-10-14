"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { classeChamp } from "@/components/formulaire";
import { validerVente } from "@/server/actions/ventes";

type ProduitCaisse = {
  id: string;
  code: string;
  codeBarres: string;
  nom: string;
  symbole: string;
  prix: number;
  stock: string;
  stocks: Record<string, string>;
};
type DepotOption = { id: string; nom: string };
type ClientOption = { id: string; nom: string; solde: number; plafondCredit: number };
type Mode = "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY" | "CREDIT";
type Paiement = { cle: number; mode: Mode; montant: string };

const LIBELLE_MODE: Record<Mode, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  CREDIT: "Crédit",
};

const fcfa = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ")} FCFA`;
const nombre = (s: string) => Number(s.replace(",", ".")) || 0;

let compteur = 1;

export function Caisse({
  produits,
  clients,
  depots,
  peutRemise,
}: {
  produits: ProduitCaisse[];
  depots: DepotOption[];
  clients: ClientOption[];
  peutRemise: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [recherche, setRecherche] = useState("");
  const [panier, setPanier] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState("");
  const [depotId, setDepotId] = useState(depots[0]?.id ?? "");
  const plusieursDepots = depots.length > 1;
  const stockDe = (p: ProduitCaisse) => (plusieursDepots ? (p.stocks[depotId] ?? "0") : p.stock);
  const [remise, setRemise] = useState("");
  const [paiements, setPaiements] = useState<Paiement[]>([
    { cle: 0, mode: "ESPECES", montant: "" },
  ]);
  const [erreur, setErreur] = useState<string>();

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return produits.filter((p) => !q || p.nom.toLowerCase().includes(q));
  }, [produits, recherche]);

  const lignes = Object.entries(panier)
    .map(([id, qte]) => ({ produit: produits.find((p) => p.id === id)!, qte }))
    .filter((l) => l.produit);

  const sousTotal = lignes.reduce((s, l) => s + Math.round(nombre(l.qte) * l.produit.prix), 0);
  const remiseNum = Math.min(Math.max(Math.round(nombre(remise)), 0), sousTotal);
  const total = sousTotal - remiseNum;
  const saisi = paiements.reduce((s, p) => s + Math.round(nombre(p.montant)), 0);
  const reste = total - saisi;
  const client = clients.find((c) => c.id === clientId);

  const ajouter = (p: ProduitCaisse) =>
    setPanier((x) => ({ ...x, [p.id]: x[p.id] ? String(nombre(x[p.id]) + 1) : "1" }));

  function tout(mode: Mode) {
    setPaiements([{ cle: compteur++, mode, montant: String(total) }]);
  }

  function valider() {
    setErreur(undefined);
    demarrer(async () => {
      const res = await validerVente({
        clientId: clientId || undefined,
        depotId: plusieursDepots ? depotId : undefined,
        remise: remiseNum,
        lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: l.qte.trim() })),
        paiements: paiements
          .map((p) => ({ mode: p.mode, montant: Math.round(nombre(p.montant)) }))
          .filter((p) => p.montant > 0),
      });
      if (res.erreur) setErreur(res.erreur);
      else if (res.id) router.push(`/ventes/${res.id}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
        {plusieursDepots && (
          <label className="mb-3 block text-sm font-medium text-gray-700">
            Vendre depuis le dépôt
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={classeChamp}>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => {
            // Un lecteur de code-barres « tape » le code puis Entrée : on ajoute le produit correspondant.
            if (e.key !== "Enter") return;
            e.preventDefault();
            const saisie = recherche.trim().toLowerCase();
            const trouve = produits.find(
              (p) => saisie && (p.codeBarres === saisie || p.code.toLowerCase() === saisie),
            );
            if (trouve && nombre(stockDe(trouve)) > 0) {
              ajouter(trouve);
              setRecherche("");
            }
          }}
          placeholder="Rechercher ou scanner un code-barres…"
          className={classeChamp}
          autoFocus
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibles.map((p) => {
            const rupture = nombre(stockDe(p)) <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={rupture}
                onClick={() => ajouter(p)}
                className="rounded-xl border border-gray-200 bg-brand-soft/40 p-3 text-left transition hover:border-brand disabled:opacity-40"
              >
                <div className="font-semibold text-brand">{p.nom}</div>
                <div className="text-sm text-gray-600">{fcfa(p.prix)}</div>
                <div className={`text-xs ${rupture ? "text-tomate" : "text-gray-500"}`}>
                  {rupture ? "Rupture" : `Stock : ${stockDe(p)} ${p.symbole}`}
                </div>
              </button>
            );
          })}
          {visibles.length === 0 && (
            <p className="col-span-full py-6 text-center text-gray-500">Aucun produit.</p>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-bold text-brand">Panier</h2>
        {lignes.length === 0 && <p className="text-sm text-gray-500">Touchez un produit pour l&apos;ajouter.</p>}
        <ul className="space-y-2">
          {lignes.map((l) => (
            <li key={l.produit.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-medium">{l.produit.nom}</span>
              <input
                inputMode="decimal"
                value={l.qte}
                onChange={(e) => setPanier((x) => ({ ...x, [l.produit.id]: e.target.value }))}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right"
              />
              <span className="w-8 text-gray-500">{l.produit.symbole}</span>
              <span className="w-28 text-right font-semibold">
                {fcfa(Math.round(nombre(l.qte) * l.produit.prix))}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPanier((x) =>
                    Object.fromEntries(Object.entries(x).filter(([k]) => k !== l.produit.id)),
                  )
                }
                className="text-tomate"
                aria-label="Retirer"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <label className="block text-sm font-medium text-gray-700">
          Client (obligatoire pour le crédit)
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={classeChamp}>
            <option value="">Client de passage</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        {client && (
          <p className="text-xs text-gray-500">
            Solde : {fcfa(client.solde)} · Plafond : {fcfa(client.plafondCredit)}
          </p>
        )}

        {peutRemise && (
          <label className="block text-sm font-medium text-gray-700">
            Remise (FCFA)
            <input
              inputMode="numeric"
              value={remise}
              onChange={(e) => setRemise(e.target.value)}
              className={classeChamp}
            />
          </label>
        )}

        <div className="border-t border-gray-100 pt-3 text-right">
          {remiseNum > 0 && <div className="text-sm text-gray-500">Remise : −{fcfa(remiseNum)}</div>}
          <div className="text-2xl font-extrabold text-brand">{fcfa(total)}</div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LIBELLE_MODE) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={total === 0}
                onClick={() => tout(m)}
                className="rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-soft disabled:opacity-40"
              >
                Tout en {LIBELLE_MODE[m]}
              </button>
            ))}
          </div>
          {paiements.map((p) => (
            <div key={p.cle} className="flex gap-2">
              <select
                value={p.mode}
                onChange={(e) =>
                  setPaiements((ps) =>
                    ps.map((x) => (x.cle === p.cle ? { ...x, mode: e.target.value as Mode } : x)),
                  )
                }
                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
              >
                {(Object.keys(LIBELLE_MODE) as Mode[]).map((m) => (
                  <option key={m} value={m}>
                    {LIBELLE_MODE[m]}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                placeholder="Montant"
                value={p.montant}
                onChange={(e) =>
                  setPaiements((ps) =>
                    ps.map((x) => (x.cle === p.cle ? { ...x, montant: e.target.value } : x)),
                  )
                }
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-right"
              />
              {paiements.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPaiements((ps) => ps.filter((x) => x.cle !== p.cle))}
                  className="text-tomate"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPaiements((ps) => [...ps, { cle: compteur++, mode: "ESPECES", montant: "" }])}
            className="text-sm font-semibold text-brand hover:underline"
          >
            + Paiement mixte
          </button>
          <div className={`text-sm font-semibold ${reste === 0 ? "text-brand" : "text-tomate"}`}>
            {reste === 0 ? "Paiement complet" : reste > 0 ? `Reste à payer : ${fcfa(reste)}` : `Trop-perçu : ${fcfa(-reste)}`}
          </div>
        </div>

        {erreur && <p className="text-sm text-tomate">{erreur}</p>}
        <button
          type="button"
          onClick={valider}
          disabled={enCours || lignes.length === 0 || reste !== 0}
          className="w-full rounded-xl bg-brand py-3 text-base font-bold text-white disabled:opacity-50"
        >
          {enCours ? "Validation…" : "Valider la vente"}
        </button>
      </section>
    </div>
  );
}

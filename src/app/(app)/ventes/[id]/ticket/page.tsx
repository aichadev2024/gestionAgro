import { notFound } from "next/navigation";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate, formatFCFA } from "@/lib/format";
import { MARQUE } from "@/lib/marque";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import { trouverVente } from "@/server/services/ventes";

const LIBELLE_MODE = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MOOV_MONEY: "Moov Money",
  CREDIT: "Crédit",
} as const;

/** Ticket de caisse étroit (imprimante thermique 80 mm). */
export default async function PageTicket({ params }: PageProps<"/ventes/[id]/ticket">) {
  await exigerAccesModule("/ventes");
  const { id } = await params;
  const vente = await trouverVente(id);
  if (!vente) notFound();

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } body { background: #fff !important; } }`}</style>
      <div className="print:hidden">
        <BoutonImprimer />
      </div>

      <div className="mx-auto w-[72mm] bg-white p-3 font-mono text-[11px] leading-tight text-black shadow print:w-full print:p-0 print:shadow-none">
        <div className="text-center">
          <div className="text-base font-bold tracking-widest">{MARQUE.nom.toUpperCase()}</div>
          <div>{MARQUE.slogan}</div>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <div>Ticket : {vente.numero}</div>
        <div>Date : {formatDate(vente.creeLe)}</div>
        <div>Client : {vente.client?.nom ?? "Passage"}</div>
        <div>Caissier : {vente.caissier.nom}</div>
        {vente.statut === "ANNULEE" && <div className="font-bold">*** ANNULÉE ***</div>}
        <hr className="my-2 border-dashed border-black" />
        {vente.lignes.map((l) => (
          <div key={l.id} className="mb-1">
            <div>{l.produit.nom}</div>
            <div className="flex justify-between">
              <span>
                {l.quantite.toString()} {l.produit.unite.symbole} x {formatFCFA(l.prixUnitaire)}
              </span>
              <span>{formatFCFA(l.quantite.mul(l.prixUnitaire).round().toNumber())}</span>
            </div>
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        {vente.remise > 0 && (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>-{formatFCFA(vente.remise)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatFCFA(vente.total)}</span>
        </div>
        {vente.paiements.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>{LIBELLE_MODE[p.mode]}</span>
            <span>{formatFCFA(p.montant)}</span>
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        <div className="text-center">Merci pour votre confiance !</div>
        <div className="text-center">
          {MARQUE.nom} {MARQUE.signature}
        </div>
      </div>
    </div>
  );
}

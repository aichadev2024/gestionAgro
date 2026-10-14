import { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { prochainNumero } from "@/server/services/sequence";

const D = (v: string | number) => new Prisma.Decimal(v);

export type ModeRemboursement = "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY" | "CREDIT";

export type LigneRetourSaisie = { ligneVenteId: string; quantite: string };

export function retoursDeVente(venteId: string) {
  return prisma.retour.findMany({
    where: { venteId },
    orderBy: { creeLe: "desc" },
    include: { lignes: { include: { ligneVente: { include: { produit: true } } } } },
  });
}

/** Quantité encore retournable pour chaque ligne d'une vente. */
export async function quantitesRetournables(venteId: string) {
  const lignes = await prisma.ligneVente.findMany({
    where: { venteId },
    include: { lots: true },
  });
  return new Map(
    lignes.map((l) => [
      l.id,
      l.lots.reduce((s, x) => s.add(x.quantite.sub(x.quantiteRetournee)), D(0)),
    ]),
  );
}

/**
 * Retour client : rembourse (espèces, mobile money ou réduction de la dette du client)
 * et, au choix, remet les produits en stock dans leurs lots d'origine.
 */
export async function creerRetour(
  auteurId: string,
  venteId: string,
  lignes: LigneRetourSaisie[],
  mode: ModeRemboursement,
  motif: string,
  remisEnStock: boolean,
) {
  if (!motif.trim()) throw new ErreurMetier("Le motif du retour est obligatoire.");
  const demandees = lignes.filter((l) => D(l.quantite).gt(0));
  if (demandees.length === 0) throw new ErreurMetier("Indiquez au moins une quantité à retourner.");

  return prisma.$transaction(
    async (tx) => {
      const vente = await tx.vente.findUniqueOrThrow({
        where: { id: venteId },
        include: {
          lignes: { include: { lots: { include: { lot: true } }, produit: true } },
        },
      });
      if (vente.statut !== "VALIDEE") throw new ErreurMetier("Cette vente est annulée.");

      // Une remise globale est répartie au prorata sur chaque produit retourné.
      const sousTotal = vente.total + vente.remise;
      const facteur = sousTotal > 0 ? vente.total / sousTotal : 1;

      const numero = await prochainNumero(tx, "AVO");
      let total = 0;
      const lignesRetour: { ligneVenteId: string; quantite: Prisma.Decimal; montant: number; cout: number }[] = [];

      for (const d of demandees) {
        const ligne = vente.lignes.find((l) => l.id === d.ligneVenteId);
        if (!ligne) throw new ErreurMetier("Ligne de vente introuvable.");
        const quantite = D(d.quantite);

        const retournable = ligne.lots.reduce(
          (s, x) => s.add(x.quantite.sub(x.quantiteRetournee)),
          D(0),
        );
        if (quantite.gt(retournable)) {
          throw new ErreurMetier(
            `${ligne.produit.nom} : retour de ${quantite} > ${retournable} encore retournable.`,
          );
        }

        let reste = quantite;
        let cout = 0;
        for (const lv of ligne.lots) {
          if (reste.lte(0)) break;
          const dispo = lv.quantite.sub(lv.quantiteRetournee);
          if (dispo.lte(0)) continue;
          const prise = Prisma.Decimal.min(reste, dispo);
          await tx.ligneVenteLot.update({
            where: { id: lv.id },
            data: { quantiteRetournee: { increment: prise } },
          });
          if (remisEnStock) {
            await tx.lot.update({
              where: { id: lv.lotId },
              data: { quantiteRestante: { increment: prise } },
            });
            await tx.mouvementStock.create({
              data: {
                lotId: lv.lotId,
                type: "RETOUR_CLIENT",
                quantite: prise,
                reference: numero,
                motif: motif.trim(),
                auteurId,
              },
            });
            cout += prise.mul(lv.lot.prixAchat).toNumber();
          }
          reste = reste.sub(prise);
        }

        const montant = Math.round(quantite.mul(ligne.prixUnitaire).toNumber() * facteur);
        total += montant;
        lignesRetour.push({
          ligneVenteId: ligne.id,
          quantite,
          montant,
          cout: Math.round(cout),
        });
      }

      if (mode === "CREDIT") {
        if (!vente.clientId) {
          throw new ErreurMetier("Un remboursement sur le compte client exige une vente liée à un client.");
        }
        const client = await tx.client.findUniqueOrThrow({ where: { id: vente.clientId } });
        if (total > client.solde) {
          throw new ErreurMetier(
            `Le client ne doit que ${client.solde} FCFA : remboursez ${total} FCFA en espèces ou mobile money.`,
          );
        }
        await tx.client.update({ where: { id: client.id }, data: { solde: { decrement: total } } });
      }

      const retour = await tx.retour.create({
        data: {
          numero,
          venteId,
          motif: motif.trim(),
          total,
          modeRemboursement: mode,
          remisEnStock,
          creeParId: auteurId,
          lignes: { create: lignesRetour },
        },
      });
      await tx.journalAction.create({
        data: {
          auteurId,
          action: "RETOUR_VENTE",
          entite: "Vente",
          entiteId: venteId,
          detail: { numero, facture: vente.numero, total, mode, remisEnStock, motif: motif.trim() },
        },
      });
      return retour;
    },
    { isolationLevel: "Serializable" },
  );
}

import { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { prochainNumero } from "@/server/services/sequence";

const D = (v: string | number) => new Prisma.Decimal(v);
const JOUR = 24 * 3600 * 1000;

function debutJournee() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function listerDepots() {
  return prisma.depot.findMany({ orderBy: { nom: "asc" } });
}

export function lotsEnStock() {
  return prisma.lot.findMany({
    where: { quantiteRestante: { gt: 0 } },
    orderBy: [{ datePeremption: { sort: "asc", nulls: "last" } }, { creeLe: "asc" }],
    include: { produit: { include: { unite: true } }, depot: true },
  });
}

export function derniersMouvements() {
  return prisma.mouvementStock.findMany({
    orderBy: { creeLe: "desc" },
    take: 30,
    include: { lot: { include: { produit: { include: { unite: true } }, depot: true } } },
  });
}

/** Stock agrégé par produit + alertes de stock bas et de péremption. */
export async function etatStock() {
  const lots = await lotsEnStock();
  const produits = await prisma.produit.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    include: { unite: true },
  });
  const aujourdhui = debutJournee();
  const dans30j = new Date(aujourdhui.getTime() + 30 * JOUR);

  const parProduit = produits.map((p) => {
    const mesLots = lots.filter((l) => l.produitId === p.id);
    const total = mesLots.reduce((s, l) => s.add(l.quantiteRestante), D(0));
    return {
      produit: p,
      total,
      lots: mesLots,
      stockBas: p.seuilAlerte.gt(0) && total.lte(p.seuilAlerte),
    };
  });

  const perimes = lots.filter((l) => l.datePeremption && l.datePeremption < aujourdhui);
  const bientot = lots.filter(
    (l) => l.datePeremption && l.datePeremption >= aujourdhui && l.datePeremption <= dans30j,
  );
  return { parProduit, perimes, bientot, aujourdhui };
}

export async function declarerPerte(
  auteurId: string,
  lotId: string,
  quantite: string,
  motif: string,
) {
  if (!motif.trim()) throw new ErreurMetier("Le motif est obligatoire.");
  const q = D(quantite);
  if (q.lte(0)) throw new ErreurMetier("Quantité invalide.");

  await prisma.$transaction(
    async (tx) => {
      const lot = await tx.lot.findUniqueOrThrow({
        where: { id: lotId },
        include: { produit: true },
      });
      if (q.gt(lot.quantiteRestante)) {
        throw new ErreurMetier(`Il ne reste que ${lot.quantiteRestante} dans ce lot.`);
      }
      await tx.lot.update({ where: { id: lotId }, data: { quantiteRestante: { decrement: q } } });
      await tx.mouvementStock.create({
        data: { lotId, type: "PERTE", quantite: q.neg(), motif: motif.trim(), auteurId },
      });
      await tx.journalAction.create({
        data: {
          auteurId,
          action: "PERTE_STOCK",
          entite: "Lot",
          entiteId: lotId,
          detail: { produit: lot.produit.nom, lot: lot.numeroLot, quantite, motif: motif.trim() },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/** Inventaire : aligne la quantité du lot sur le comptage physique et trace l'écart. */
export async function inventorierLot(
  auteurId: string,
  lotId: string,
  quantiteComptee: string,
  motif: string,
) {
  const compte = D(quantiteComptee);
  if (compte.lt(0)) throw new ErreurMetier("Quantité invalide.");

  await prisma.$transaction(
    async (tx) => {
      const lot = await tx.lot.findUniqueOrThrow({
        where: { id: lotId },
        include: { produit: true },
      });
      const ecart = compte.sub(lot.quantiteRestante);
      if (ecart.isZero()) throw new ErreurMetier("Aucun écart : le comptage correspond au stock.");
      if (!motif.trim()) throw new ErreurMetier("Précisez la cause de l'écart.");

      await tx.lot.update({ where: { id: lotId }, data: { quantiteRestante: compte } });
      await tx.mouvementStock.create({
        data: { lotId, type: "INVENTAIRE", quantite: ecart, motif: motif.trim(), auteurId },
      });
      await tx.journalAction.create({
        data: {
          auteurId,
          action: "AJUSTEMENT_INVENTAIRE",
          entite: "Lot",
          entiteId: lotId,
          detail: {
            produit: lot.produit.nom,
            lot: lot.numeroLot,
            avant: lot.quantiteRestante.toString(),
            apres: compte.toString(),
            motif: motif.trim(),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/** Transfert d'une partie d'un lot vers un autre dépôt (lot équivalent créé ou complété). */
export async function transfererLot(
  auteurId: string,
  lotId: string,
  depotDestId: string,
  quantite: string,
) {
  const q = D(quantite);
  if (q.lte(0)) throw new ErreurMetier("Quantité invalide.");

  await prisma.$transaction(
    async (tx) => {
      const source = await tx.lot.findUniqueOrThrow({ where: { id: lotId } });
      if (source.depotId === depotDestId) {
        throw new ErreurMetier("Le dépôt de destination doit être différent.");
      }
      if (q.gt(source.quantiteRestante)) {
        throw new ErreurMetier(`Il ne reste que ${source.quantiteRestante} dans ce lot.`);
      }
      await tx.depot.findUniqueOrThrow({ where: { id: depotDestId } });

      const reference = await prochainNumero(tx, "TRF");

      await tx.lot.update({ where: { id: lotId }, data: { quantiteRestante: { decrement: q } } });
      await tx.mouvementStock.create({
        data: { lotId, type: "TRANSFERT_SORTIE", quantite: q.neg(), reference, auteurId },
      });

      const existant = await tx.lot.findFirst({
        where: {
          produitId: source.produitId,
          depotId: depotDestId,
          numeroLot: source.numeroLot,
          datePeremption: source.datePeremption,
        },
      });
      const dest = existant
        ? await tx.lot.update({
            where: { id: existant.id },
            data: { quantiteRestante: { increment: q } },
          })
        : await tx.lot.create({
            data: {
              produitId: source.produitId,
              depotId: depotDestId,
              numeroLot: source.numeroLot,
              datePeremption: source.datePeremption,
              quantiteInitiale: q,
              quantiteRestante: q,
              prixAchat: source.prixAchat,
            },
          });
      await tx.mouvementStock.create({
        data: { lotId: dest.id, type: "TRANSFERT_ENTREE", quantite: q, reference, auteurId },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

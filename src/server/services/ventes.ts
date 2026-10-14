import { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { prochainNumero } from "@/server/services/sequence";

export type LigneVenteSaisie = { produitId: string; quantite: string };
export type PaiementSaisi = { mode: "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY" | "CREDIT"; montant: number };
export type VenteSaisie = {
  clientId?: string;
  lignes: LigneVenteSaisie[];
  paiements: PaiementSaisi[];
  remise: number;
  depotId?: string;
};

const D = (v: string | number) => new Prisma.Decimal(v);

export function listerVentes(recherche?: string, page = 1, parPage = 25) {
  const where = recherche
    ? {
        OR: [
          { numero: { contains: recherche, mode: "insensitive" as const } },
          { client: { nom: { contains: recherche, mode: "insensitive" as const } } },
        ],
      }
    : {};
  return Promise.all([
    prisma.vente.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip: (page - 1) * parPage,
      take: parPage,
      include: { client: true, caissier: { select: { nom: true } } },
    }),
    prisma.vente.count({ where }),
  ]);
}

export function trouverVente(id: string) {
  return prisma.vente.findUnique({
    where: { id },
    include: {
      client: true,
      caissier: { select: { nom: true } },
      paiements: true,
      lignes: { include: { produit: { include: { unite: true } } }, orderBy: { id: "asc" } },
    },
  });
}

export function listerClients() {
  return prisma.client.findMany({ orderBy: { nom: "asc" } });
}

/** Produits actifs avec leur stock vendable (lots non périmés), au total et par dépôt. */
export async function produitsPourCaisse() {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const [produits, lots] = await Promise.all([
    prisma.produit.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
      include: { unite: true },
    }),
    prisma.lot.groupBy({
      by: ["produitId", "depotId"],
      where: {
        quantiteRestante: { gt: 0 },
        OR: [{ datePeremption: null }, { datePeremption: { gte: aujourdhui } }],
      },
      _sum: { quantiteRestante: true },
    }),
  ]);
  return produits.map((p) => {
    const stocks: Record<string, string> = {};
    let total = D(0);
    for (const l of lots.filter((x) => x.produitId === p.id)) {
      const q = l._sum.quantiteRestante ?? D(0);
      stocks[l.depotId] = q.toString();
      total = total.add(q);
    }
    return {
      id: p.id,
      code: p.code,
      codeBarres: p.codeBarres ?? "",
      nom: p.nom,
      symbole: p.unite.symbole,
      prix: p.prixVente,
      stock: total.toString(),
      stocks,
    };
  });
}

/**
 * Enregistre une vente : sortie des lots en FEFO (péremption la plus proche d'abord),
 * paiements, plafond de crédit et numérotation, le tout dans une seule transaction.
 */
export async function creerVente(auteurId: string, saisie: VenteSaisie) {
  if (saisie.lignes.length === 0) throw new ErreurMetier("Le panier est vide.");
  if (saisie.remise < 0) throw new ErreurMetier("Remise invalide.");

  return prisma.$transaction(
    async (tx) => {
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);

      let sousTotal = 0;
      const lignesCalculees: {
        produitId: string;
        quantite: Prisma.Decimal;
        prixUnitaire: number;
        prises: { lotId: string; quantite: Prisma.Decimal }[];
      }[] = [];

      for (const l of saisie.lignes) {
        const quantite = D(l.quantite);
        if (quantite.lte(0)) throw new ErreurMetier("Quantité invalide.");
        const produit = await tx.produit.findUniqueOrThrow({ where: { id: l.produitId } });
        if (!produit.actif) throw new ErreurMetier(`${produit.nom} n'est plus en vente.`);

        const lots = await tx.lot.findMany({
          where: {
            produitId: produit.id,
            ...(saisie.depotId ? { depotId: saisie.depotId } : {}),
            quantiteRestante: { gt: 0 },
            OR: [{ datePeremption: null }, { datePeremption: { gte: aujourdhui } }],
          },
          orderBy: [{ datePeremption: { sort: "asc", nulls: "last" } }, { creeLe: "asc" }],
        });

        let reste = quantite;
        const prises: { lotId: string; quantite: Prisma.Decimal }[] = [];
        for (const lot of lots) {
          if (reste.lte(0)) break;
          const prise = Prisma.Decimal.min(reste, lot.quantiteRestante);
          prises.push({ lotId: lot.id, quantite: prise });
          reste = reste.sub(prise);
        }
        if (reste.gt(0)) {
          throw new ErreurMetier(
            `Stock insuffisant pour ${produit.nom} (manque ${reste.toString()}).`,
          );
        }

        sousTotal += quantite.mul(produit.prixVente).round().toNumber();
        lignesCalculees.push({
          produitId: produit.id,
          quantite,
          prixUnitaire: produit.prixVente,
          prises,
        });
      }

      if (saisie.remise > sousTotal) throw new ErreurMetier("La remise dépasse le total.");
      const total = sousTotal - saisie.remise;

      const paye = saisie.paiements.reduce((s, p) => s + p.montant, 0);
      if (saisie.paiements.some((p) => p.montant < 0 || !Number.isInteger(p.montant))) {
        throw new ErreurMetier("Montant de paiement invalide.");
      }
      if (paye !== total) {
        throw new ErreurMetier(`Les paiements (${paye}) doivent égaler le total (${total}).`);
      }

      const credit = saisie.paiements
        .filter((p) => p.mode === "CREDIT")
        .reduce((s, p) => s + p.montant, 0);
      if (credit > 0) {
        if (!saisie.clientId) throw new ErreurMetier("Un client est requis pour une vente à crédit.");
        const client = await tx.client.findUniqueOrThrow({ where: { id: saisie.clientId } });
        if (client.solde + credit > client.plafondCredit) {
          throw new ErreurMetier(
            `Plafond de crédit dépassé (solde ${client.solde} + ${credit} > ${client.plafondCredit}).`,
          );
        }
        await tx.client.update({
          where: { id: client.id },
          data: { solde: { increment: credit } },
        });
      }

      const numero = await prochainNumero(tx, "FAC");
      const vente = await tx.vente.create({
        data: {
          numero,
          clientId: saisie.clientId || null,
          caissierId: auteurId,
          statut: "VALIDEE",
          total,
          remise: saisie.remise,
          paiements: {
            create: saisie.paiements
              .filter((p) => p.montant > 0)
              .map((p) => ({ mode: p.mode, montant: p.montant })),
          },
        },
      });

      for (const l of lignesCalculees) {
        const ligne = await tx.ligneVente.create({
          data: {
            venteId: vente.id,
            produitId: l.produitId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          },
        });
        for (const p of l.prises) {
          await tx.lot.update({
            where: { id: p.lotId },
            data: { quantiteRestante: { decrement: p.quantite } },
          });
          await tx.ligneVenteLot.create({
            data: { ligneVenteId: ligne.id, lotId: p.lotId, quantite: p.quantite },
          });
          await tx.mouvementStock.create({
            data: {
              lotId: p.lotId,
              type: "VENTE",
              quantite: p.quantite.neg(),
              reference: numero,
              auteurId,
            },
          });
        }
      }

      if (saisie.remise > 0) {
        await tx.journalAction.create({
          data: {
            auteurId,
            action: "REMISE_VENTE",
            entite: "Vente",
            entiteId: vente.id,
            detail: { numero, remise: saisie.remise, total },
          },
        });
      }
      return vente;
    },
    { isolationLevel: "Serializable" },
  );
}

/** Annulation : remet les quantités dans les lots d'origine, sans rien supprimer. */
export async function annulerVente(auteurId: string, venteId: string, motif: string) {
  if (!motif.trim()) throw new ErreurMetier("Le motif d'annulation est obligatoire.");

  await prisma.$transaction(
    async (tx) => {
      const vente = await tx.vente.findUniqueOrThrow({
        where: { id: venteId },
        include: { paiements: true, lignes: { include: { lots: true } } },
      });
      if (vente.statut !== "VALIDEE") throw new ErreurMetier("Cette vente est déjà annulée.");
      if ((await tx.retour.count({ where: { venteId } })) > 0) {
        throw new ErreurMetier("Annulation impossible : des retours existent sur cette vente.");
      }

      for (const ligne of vente.lignes) {
        for (const p of ligne.lots) {
          await tx.lot.update({
            where: { id: p.lotId },
            data: { quantiteRestante: { increment: p.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              lotId: p.lotId,
              type: "ANNULATION_VENTE",
              quantite: p.quantite,
              reference: vente.numero,
              motif: motif.trim(),
              auteurId,
            },
          });
        }
      }

      const credit = vente.paiements
        .filter((p) => p.mode === "CREDIT")
        .reduce((s, p) => s + p.montant, 0);
      if (credit > 0 && vente.clientId) {
        await tx.client.update({
          where: { id: vente.clientId },
          data: { solde: { decrement: credit } },
        });
      }

      await tx.vente.update({
        where: { id: venteId },
        data: { statut: "ANNULEE", motifAnnulation: motif.trim(), annuleeParId: auteurId },
      });
      await tx.journalAction.create({
        data: {
          auteurId,
          action: "ANNULATION_VENTE",
          entite: "Vente",
          entiteId: venteId,
          detail: { numero: vente.numero, motif: motif.trim() },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

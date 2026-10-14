import { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { choisirDepot } from "@/server/services/depots";
import { prochainNumero } from "@/server/services/sequence";

const D = (v: string | number) => new Prisma.Decimal(v);

export type LigneRecetteSaisie = { produitId: string; quantite: string };

export function listerRecettes() {
  return prisma.recette.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    include: {
      produitFini: { include: { unite: true } },
      lignes: { include: { produit: { include: { unite: true } } } },
    },
  });
}

export function listerProductions() {
  return prisma.production.findMany({
    orderBy: { creeLe: "desc" },
    take: 100,
    include: { recette: { include: { produitFini: { include: { unite: true } } } } },
  });
}

export function trouverProduction(id: string) {
  return prisma.production.findUnique({
    where: { id },
    include: {
      lot: true,
      recette: {
        include: {
          produitFini: { include: { unite: true } },
          lignes: { include: { produit: { include: { unite: true } } } },
        },
      },
      consommations: {
        include: { lot: { include: { produit: { include: { unite: true } } } } },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function creerRecette(
  nom: string,
  produitFiniId: string,
  quantiteProduite: string,
  lignes: LigneRecetteSaisie[],
) {
  if (D(quantiteProduite).lte(0)) throw new ErreurMetier("La quantité produite doit être positive.");
  if (lignes.length === 0) throw new ErreurMetier("Ajoutez au moins une matière première.");
  const ids = new Set(lignes.map((l) => l.produitId));
  if (ids.size !== lignes.length) throw new ErreurMetier("Une matière est répétée.");
  if (ids.has(produitFiniId)) {
    throw new ErreurMetier("Le produit fini ne peut pas être sa propre matière première.");
  }
  if (lignes.some((l) => D(l.quantite).lte(0))) throw new ErreurMetier("Quantité invalide.");

  return prisma.recette.create({
    data: {
      nom,
      produitFiniId,
      quantiteProduite: D(quantiteProduite),
      lignes: { create: lignes.map((l) => ({ produitId: l.produitId, quantite: D(l.quantite) })) },
    },
  });
}

/**
 * Lance une production : consomme les matières en FEFO, crée le lot de produit fini
 * et calcule son coût de revient, dans une seule transaction.
 */
export async function produire(
  auteurId: string,
  recetteId: string,
  multiplicateur: string,
  quantiteObtenue: string,
  numeroLot: string,
  datePeremption?: string,
  depotId?: string,
) {
  const mult = D(multiplicateur);
  const obtenue = D(quantiteObtenue);
  if (mult.lte(0)) throw new ErreurMetier("Nombre de lots invalide.");
  if (obtenue.lte(0)) throw new ErreurMetier("La quantité obtenue doit être positive.");
  if (!numeroLot.trim()) throw new ErreurMetier("Numéro de lot requis.");

  return prisma.$transaction(
    async (tx) => {
      const recette = await tx.recette.findUniqueOrThrow({
        where: { id: recetteId },
        include: { produitFini: true, lignes: { include: { produit: true } } },
      });
      if (recette.produitFini.perissable && !datePeremption) {
        throw new ErreurMetier("Date de péremption requise pour ce produit fini.");
      }
      const depot = await choisirDepot(tx, depotId);

      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      const numero = await prochainNumero(tx, "PROD");

      const prises: { lotId: string; quantite: Prisma.Decimal }[] = [];
      let cout = 0;

      for (const ligne of recette.lignes) {
        const besoin = ligne.quantite.mul(mult);
        const lots = await tx.lot.findMany({
          where: {
            produitId: ligne.produitId,
            quantiteRestante: { gt: 0 },
            OR: [{ datePeremption: null }, { datePeremption: { gte: aujourdhui } }],
          },
          orderBy: [{ datePeremption: { sort: "asc", nulls: "last" } }, { creeLe: "asc" }],
        });
        let reste = besoin;
        for (const lot of lots) {
          if (reste.lte(0)) break;
          const prise = Prisma.Decimal.min(reste, lot.quantiteRestante);
          await tx.lot.update({
            where: { id: lot.id },
            data: { quantiteRestante: { decrement: prise } },
          });
          await tx.mouvementStock.create({
            data: {
              lotId: lot.id,
              type: "PRODUCTION_SORTIE",
              quantite: prise.neg(),
              reference: numero,
              auteurId,
            },
          });
          prises.push({ lotId: lot.id, quantite: prise });
          cout += prise.mul(lot.prixAchat).toNumber();
          reste = reste.sub(prise);
        }
        if (reste.gt(0)) {
          throw new ErreurMetier(
            `Stock insuffisant de ${ligne.produit.nom} (manque ${reste.toString()}).`,
          );
        }
      }

      const coutTotal = Math.round(cout);
      const lotFini = await tx.lot.create({
        data: {
          produitId: recette.produitFiniId,
          depotId: depot.id,
          numeroLot: numeroLot.trim(),
          datePeremption: datePeremption ? new Date(datePeremption) : null,
          quantiteInitiale: obtenue,
          quantiteRestante: obtenue,
          // Coût de revient unitaire = coût des matières / quantité réellement obtenue.
          prixAchat: Math.round(coutTotal / obtenue.toNumber()),
        },
      });
      await tx.mouvementStock.create({
        data: {
          lotId: lotFini.id,
          type: "PRODUCTION_ENTREE",
          quantite: obtenue,
          reference: numero,
          auteurId,
        },
      });

      return tx.production.create({
        data: {
          numero,
          recetteId,
          multiplicateur: mult,
          quantiteTheorique: recette.quantiteProduite.mul(mult),
          quantiteObtenue: obtenue,
          coutTotal,
          lotId: lotFini.id,
          creeParId: auteurId,
          consommations: { create: prises },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/** Annulation : rend les matières et retire le produit fini, tant qu'il n'a pas bougé. */
export async function annulerProduction(auteurId: string, id: string, motif: string) {
  if (!motif.trim()) throw new ErreurMetier("Le motif d'annulation est obligatoire.");

  await prisma.$transaction(
    async (tx) => {
      const prod = await tx.production.findUniqueOrThrow({
        where: { id },
        include: { lot: true, consommations: true },
      });
      if (prod.statut !== "VALIDEE") throw new ErreurMetier("Production déjà annulée.");
      if (!prod.lot.quantiteRestante.equals(prod.lot.quantiteInitiale)) {
        throw new ErreurMetier(
          "Le produit fini a déjà été vendu ou déplacé : annulation impossible.",
        );
      }

      await tx.lot.update({ where: { id: prod.lotId }, data: { quantiteRestante: 0 } });
      await tx.mouvementStock.create({
        data: {
          lotId: prod.lotId,
          type: "PRODUCTION_SORTIE",
          quantite: prod.quantiteObtenue.neg(),
          reference: prod.numero,
          motif: `Annulation : ${motif.trim()}`,
          auteurId,
        },
      });
      for (const c of prod.consommations) {
        await tx.lot.update({
          where: { id: c.lotId },
          data: { quantiteRestante: { increment: c.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            lotId: c.lotId,
            type: "PRODUCTION_ENTREE",
            quantite: c.quantite,
            reference: prod.numero,
            motif: `Annulation : ${motif.trim()}`,
            auteurId,
          },
        });
      }
      await tx.production.update({
        where: { id },
        data: { statut: "ANNULEE", motifAnnulation: motif.trim(), annuleParId: auteurId },
      });
      await tx.journalAction.create({
        data: {
          auteurId,
          action: "ANNULATION_PRODUCTION",
          entite: "Production",
          entiteId: id,
          detail: { numero: prod.numero, motif: motif.trim() },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

import { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { choisirDepot } from "@/server/services/depots";
import { prochainNumero } from "@/server/services/sequence";

export type LigneCommande = { produitId: string; quantite: string; prixUnitaire: number };
export type LigneReception = {
  ligneId: string;
  quantite: string;
  numeroLot: string;
  datePeremption?: string;
};

const D = (v: string | number) => new Prisma.Decimal(v);

export function listerFournisseurs() {
  return prisma.fournisseur.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { achats: true } } },
  });
}

export function listerAchats(recherche?: string, page = 1, parPage = 25) {
  const where = recherche
    ? {
        OR: [
          { numero: { contains: recherche, mode: "insensitive" as const } },
          { fournisseur: { nom: { contains: recherche, mode: "insensitive" as const } } },
        ],
      }
    : {};
  return Promise.all([
    prisma.achat.findMany({
      where,
      orderBy: { creeLe: "desc" },
      skip: (page - 1) * parPage,
      take: parPage,
      include: { fournisseur: true, paiements: { select: { montant: true } } },
    }),
    prisma.achat.count({ where }),
  ]);
}

/** Reste à payer au fournisseur : total de la commande moins les paiements enregistrés. */
export function resteAPayer(achat: { total: number; statut: string; paiements: { montant: number }[] }) {
  if (achat.statut === "ANNULE") return 0;
  return achat.total - achat.paiements.reduce((s, p) => s + p.montant, 0);
}

export async function dettesFournisseurs() {
  const achats = await prisma.achat.findMany({
    where: { statut: { not: "ANNULE" } },
    select: { total: true, statut: true, paiements: { select: { montant: true } } },
  });
  return achats.reduce((s, a) => s + resteAPayer(a), 0);
}

export async function payerAchat(
  auteurId: string,
  achatId: string,
  montant: number,
  mode: "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY",
) {
  if (!Number.isInteger(montant) || montant <= 0) {
    throw new ErreurMetier("Le montant doit être un entier positif (FCFA).");
  }
  await prisma.$transaction(
    async (tx) => {
      const achat = await tx.achat.findUniqueOrThrow({
        where: { id: achatId },
        include: { paiements: { select: { montant: true } } },
      });
      if (achat.statut === "ANNULE") throw new ErreurMetier("Cette commande est annulée.");
      const reste = resteAPayer(achat);
      if (montant > reste) {
        throw new ErreurMetier(`Il ne reste que ${reste} FCFA à payer sur cette commande.`);
      }
      await tx.paiementAchat.create({ data: { achatId, montant, mode, creeParId: auteurId } });
    },
    { isolationLevel: "Serializable" },
  );
}

export function modifierFournisseur(
  id: string,
  d: { nom: string; telephone?: string; adresse?: string },
) {
  return prisma.fournisseur.update({
    where: { id },
    data: { nom: d.nom, telephone: d.telephone || null, adresse: d.adresse || null },
  });
}

export function trouverAchat(id: string) {
  return prisma.achat.findUnique({
    where: { id },
    include: {
      fournisseur: true,
      paiements: { orderBy: { creeLe: "desc" } },
      lignes: { include: { produit: { include: { unite: true } } }, orderBy: { id: "asc" } },
    },
  });
}

export async function creerBonDeCommande(
  auteurId: string,
  fournisseurId: string,
  lignes: LigneCommande[],
) {
  if (lignes.length === 0) throw new ErreurMetier("Ajoutez au moins une ligne.");

  return prisma.$transaction(async (tx) => {
    const total = lignes.reduce(
      (somme, l) => somme + D(l.quantite).mul(l.prixUnitaire).round().toNumber(),
      0,
    );
    const numero = await prochainNumero(tx, "BC");
    return tx.achat.create({
      data: {
        numero,
        fournisseurId,
        statut: "COMMANDE",
        total,
        creeParId: auteurId,
        lignes: {
          create: lignes.map((l) => ({
            produitId: l.produitId,
            quantite: D(l.quantite),
            prixUnitaire: l.prixUnitaire,
          })),
        },
      },
    });
  });
}

/** Réception (totale ou partielle) : crée un lot et un mouvement de stock par ligne reçue. */
export async function receptionner(
  auteurId: string,
  achatId: string,
  lignes: LigneReception[],
  depotId?: string,
) {
  const aRecevoir = lignes.filter((l) => D(l.quantite).gt(0));
  if (aRecevoir.length === 0) throw new ErreurMetier("Saisissez au moins une quantité reçue.");

  return prisma.$transaction(
    async (tx) => {
      const achat = await tx.achat.findUniqueOrThrow({
        where: { id: achatId },
        include: { lignes: { include: { produit: true } } },
      });
      if (achat.statut !== "COMMANDE" && achat.statut !== "RECU_PARTIEL") {
        throw new ErreurMetier("Cette commande ne peut plus être réceptionnée.");
      }
      const depot = await choisirDepot(tx, depotId);

      for (const r of aRecevoir) {
        const ligne = achat.lignes.find((l) => l.id === r.ligneId);
        if (!ligne) throw new ErreurMetier("Ligne de commande introuvable.");

        const quantite = D(r.quantite);
        const reste = ligne.quantite.sub(ligne.quantiteRecue);
        if (quantite.gt(reste)) {
          throw new ErreurMetier(
            `${ligne.produit.nom} : reçu ${quantite} > reste à recevoir ${reste}.`,
          );
        }
        if (!r.numeroLot.trim()) {
          throw new ErreurMetier(`${ligne.produit.nom} : numéro de lot requis.`);
        }
        if (ligne.produit.perissable && !r.datePeremption) {
          throw new ErreurMetier(`${ligne.produit.nom} : date de péremption requise.`);
        }

        const lot = await tx.lot.create({
          data: {
            produitId: ligne.produitId,
            depotId: depot.id,
            numeroLot: r.numeroLot.trim(),
            datePeremption: r.datePeremption ? new Date(r.datePeremption) : null,
            quantiteInitiale: quantite,
            quantiteRestante: quantite,
            prixAchat: ligne.prixUnitaire,
          },
        });
        await tx.mouvementStock.create({
          data: {
            lotId: lot.id,
            type: "RECEPTION",
            quantite,
            reference: achat.numero,
            auteurId,
          },
        });
        await tx.ligneAchat.update({
          where: { id: ligne.id },
          data: { quantiteRecue: { increment: quantite } },
        });
      }

      const apres = await tx.ligneAchat.findMany({ where: { achatId } });
      const toutRecu = apres.every((l) => l.quantiteRecue.gte(l.quantite));
      await tx.achat.update({
        where: { id: achatId },
        data: { statut: toutRecu ? "RECU" : "RECU_PARTIEL" },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

/** Annulation : uniquement si rien n'a été reçu. Aucune suppression physique. */
export async function annulerAchat(auteurId: string, achatId: string, motif: string) {
  if (!motif.trim()) throw new ErreurMetier("Le motif d'annulation est obligatoire.");

  await prisma.$transaction(async (tx) => {
    const achat = await tx.achat.findUniqueOrThrow({
      where: { id: achatId },
      include: { lignes: true },
    });
    if (achat.statut !== "COMMANDE") {
      throw new ErreurMetier("Seule une commande sans réception peut être annulée.");
    }
    await tx.achat.update({
      where: { id: achatId },
      data: { statut: "ANNULE", motifAnnulation: motif.trim(), annuleParId: auteurId },
    });
    await tx.journalAction.create({
      data: {
        auteurId,
        action: "ANNULATION_ACHAT",
        entite: "Achat",
        entiteId: achatId,
        detail: { numero: achat.numero, motif: motif.trim() },
      },
    });
  });
}

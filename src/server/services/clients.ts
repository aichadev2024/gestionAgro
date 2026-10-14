import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";

export type ModeEncaissement = "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY";

export function listerClientsAvecSolde() {
  return prisma.client.findMany({
    orderBy: [{ solde: "desc" }, { nom: "asc" }],
    include: {
      encaissements: { orderBy: { creeLe: "desc" }, take: 5 },
    },
  });
}

export function derniersEncaissements() {
  return prisma.encaissementClient.findMany({
    orderBy: { creeLe: "desc" },
    take: 30,
    include: { client: { select: { nom: true } } },
  });
}

/** Enregistre le remboursement (total ou partiel) d'un client à crédit. */
export async function encaisserCreance(
  auteurId: string,
  clientId: string,
  montant: number,
  mode: ModeEncaissement,
  note?: string,
) {
  if (!Number.isInteger(montant) || montant <= 0) {
    throw new ErreurMetier("Le montant doit être un nombre entier positif (FCFA).");
  }
  await prisma.$transaction(
    async (tx) => {
      const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
      if (montant > client.solde) {
        throw new ErreurMetier(
          `Le client ne doit que ${client.solde} FCFA : impossible d'encaisser ${montant} FCFA.`,
        );
      }
      await tx.client.update({ where: { id: clientId }, data: { solde: { decrement: montant } } });
      await tx.encaissementClient.create({
        data: { clientId, montant, mode, note: note?.trim() || null, creeParId: auteurId },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function modifierClient(
  id: string,
  d: { nom: string; telephone?: string; plafondCredit?: number },
) {
  await prisma.client.update({
    where: { id },
    data: {
      nom: d.nom,
      telephone: d.telephone || null,
      ...(d.plafondCredit !== undefined ? { plafondCredit: d.plafondCredit } : {}),
    },
  });
}

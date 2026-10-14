import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";

/** Bornes locales d'une journée : [00:00, lendemain 00:00[. */
export function journee(date = new Date()) {
  const debut = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

/**
 * Espèces attendues dans le tiroir-caisse pour un utilisateur sur une journée :
 * ventes en espèces + remboursements de crédit en espèces
 * − retours remboursés en espèces − dépenses payées en espèces.
 */
export async function especesAttendues(userId: string, date = new Date()) {
  const { debut, fin } = journee(date);
  const periode = { gte: debut, lt: fin };

  const [ventes, encaissements, retours, depenses, mobile] = await Promise.all([
    prisma.paiement.aggregate({
      where: { mode: "ESPECES", vente: { statut: "VALIDEE", caissierId: userId, creeLe: periode } },
      _sum: { montant: true },
    }),
    prisma.encaissementClient.aggregate({
      where: { mode: "ESPECES", creeParId: userId, creeLe: periode },
      _sum: { montant: true },
    }),
    prisma.retour.aggregate({
      where: { modeRemboursement: "ESPECES", creeParId: userId, creeLe: periode },
      _sum: { total: true },
    }),
    prisma.depense.aggregate({
      where: { mode: "ESPECES", statut: "VALIDEE", creeParId: userId, dateDepense: periode },
      _sum: { montant: true },
    }),
    prisma.paiement.aggregate({
      where: {
        mode: { in: ["ORANGE_MONEY", "MOOV_MONEY"] },
        vente: { statut: "VALIDEE", caissierId: userId, creeLe: periode },
      },
      _sum: { montant: true },
    }),
  ]);

  const ventesEspeces = ventes._sum.montant ?? 0;
  const creances = encaissements._sum.montant ?? 0;
  const retoursEspeces = retours._sum.total ?? 0;
  const depensesEspeces = depenses._sum.montant ?? 0;
  return {
    ventesEspeces,
    creances,
    retoursEspeces,
    depensesEspeces,
    mobileMoney: mobile._sum.montant ?? 0,
    attendu: ventesEspeces + creances - retoursEspeces - depensesEspeces,
  };
}

export async function cloturerCaisse(userId: string, compte: number, note?: string) {
  if (!Number.isInteger(compte) || compte < 0) {
    throw new ErreurMetier("Le montant compté doit être un entier positif ou nul (FCFA).");
  }
  const { debut } = journee();
  const deja = await prisma.clotureCaisse.findUnique({
    where: { jour_creeParId: { jour: debut, creeParId: userId } },
  });
  if (deja) throw new ErreurMetier("La caisse d'aujourd'hui est déjà clôturée.");

  const { attendu } = await especesAttendues(userId);
  return prisma.clotureCaisse.create({
    data: {
      jour: debut,
      attendu,
      compte,
      ecart: compte - attendu,
      note: note?.trim() || null,
      creeParId: userId,
    },
  });
}

export function listerClotures(userId: string | null) {
  return prisma.clotureCaisse.findMany({
    where: userId ? { creeParId: userId } : {},
    orderBy: { creeLe: "desc" },
    take: 30,
  });
}

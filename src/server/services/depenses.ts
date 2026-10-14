import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";

export const CATEGORIES_DEPENSE = [
  "Loyer",
  "Salaires",
  "Transport",
  "Électricité",
  "Eau",
  "Téléphone / Internet",
  "Entretien et réparations",
  "Taxes et impôts",
  "Emballages",
  "Autre",
] as const;

export type ModeDepense = "ESPECES" | "ORANGE_MONEY" | "MOOV_MONEY";

export function listerDepenses(recherche?: string, page = 1, parPage = 25) {
  const where = recherche
    ? {
        OR: [
          { libelle: { contains: recherche, mode: "insensitive" as const } },
          { categorie: { contains: recherche, mode: "insensitive" as const } },
        ],
      }
    : {};
  return Promise.all([
    prisma.depense.findMany({
      where,
      orderBy: [{ dateDepense: "desc" }, { creeLe: "desc" }],
      skip: (page - 1) * parPage,
      take: parPage,
    }),
    prisma.depense.count({ where }),
  ]);
}

export async function creerDepense(
  auteurId: string,
  d: {
    categorie: string;
    libelle: string;
    montant: number;
    mode: ModeDepense;
    dateDepense: string;
  },
) {
  if (!Number.isInteger(d.montant) || d.montant <= 0) {
    throw new ErreurMetier("Le montant doit être un entier positif (FCFA).");
  }
  const date = new Date(d.dateDepense);
  if (Number.isNaN(date.getTime())) throw new ErreurMetier("Date invalide.");
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) {
    throw new ErreurMetier("La date de la dépense ne peut pas être dans le futur.");
  }
  return prisma.depense.create({
    data: {
      categorie: d.categorie,
      libelle: d.libelle,
      montant: d.montant,
      mode: d.mode,
      dateDepense: date,
      creeParId: auteurId,
    },
  });
}

/** Annulation avec motif et auteur, sans suppression physique. */
export async function annulerDepense(auteurId: string, id: string, motif: string) {
  if (!motif.trim()) throw new ErreurMetier("Le motif d'annulation est obligatoire.");
  await prisma.$transaction(async (tx) => {
    const dep = await tx.depense.findUniqueOrThrow({ where: { id } });
    if (dep.statut !== "VALIDEE") throw new ErreurMetier("Dépense déjà annulée.");
    await tx.depense.update({
      where: { id },
      data: { statut: "ANNULEE", motifAnnulation: motif.trim(), annuleParId: auteurId },
    });
    await tx.journalAction.create({
      data: {
        auteurId,
        action: "ANNULATION_DEPENSE",
        entite: "Depense",
        entiteId: id,
        detail: { libelle: dep.libelle, montant: dep.montant, motif: motif.trim() },
      },
    });
  });
}

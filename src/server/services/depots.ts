import type { Prisma } from "@/generated/prisma/client";
import { ErreurMetier } from "@/lib/erreurs";

/** Dépôt demandé, ou le premier par ordre alphabétique si aucun n'est précisé. */
export async function choisirDepot(tx: Prisma.TransactionClient, depotId?: string) {
  const depot = depotId
    ? await tx.depot.findUnique({ where: { id: depotId } })
    : await tx.depot.findFirst({ orderBy: { nom: "asc" } });
  if (!depot) throw new ErreurMetier(depotId ? "Dépôt introuvable." : "Aucun dépôt configuré.");
  return depot;
}

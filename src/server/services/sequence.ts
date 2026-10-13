import type { Prisma } from "@/generated/prisma/client";

/**
 * Prochain numéro de pièce (ex. BC-2026-000123).
 * À appeler dans la transaction de la pièce : l'incrément est atomique.
 */
export async function prochainNumero(tx: Prisma.TransactionClient, prefixe: string) {
  const annee = new Date().getFullYear();
  const cle = `${prefixe}-${annee}`;
  const seq = await tx.sequence.upsert({
    where: { cle },
    create: { cle, valeur: 1 },
    update: { valeur: { increment: 1 } },
  });
  return `${cle}-${String(seq.valeur).padStart(6, "0")}`;
}

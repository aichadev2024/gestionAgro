import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class ErreurMetier extends Error {}

export type EtatFormulaire = { erreur?: string; ok?: boolean } | undefined;

export function messageErreur(e: unknown): string {
  if (e instanceof ErreurMetier) return e.message;
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Données invalides";
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return "Cet élément existe déjà.";
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
    return "Opération simultanée détectée, veuillez réessayer.";
  }
  console.error(e);
  return "Erreur inattendue.";
}

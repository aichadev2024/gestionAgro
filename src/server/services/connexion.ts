import { prisma } from "@/lib/prisma";

export const MAX_ECHECS = 5;
export const FENETRE_MIN = 15;

const email = (e: string) => e.trim().toLowerCase();
const depuisMinutes = (m: number) => new Date(Date.now() - m * 60_000);

/** Vrai si trop d'essais ratés récents : la connexion est refusée même avec le bon mot de passe. */
export async function compteBloque(adresse: string) {
  const echecs = await prisma.tentativeConnexion.count({
    where: { email: email(adresse), reussie: false, creeLe: { gte: depuisMinutes(FENETRE_MIN) } },
  });
  return echecs >= MAX_ECHECS;
}

export async function enregistrerEchec(adresse: string) {
  await prisma.tentativeConnexion.create({ data: { email: email(adresse), reussie: false } });
  // Purge des anciennes tentatives pour que la table reste petite.
  await prisma.tentativeConnexion.deleteMany({ where: { creeLe: { lt: depuisMinutes(24 * 60) } } });
}

export async function enregistrerSucces(adresse: string) {
  // Une connexion réussie remet le compteur à zéro.
  await prisma.tentativeConnexion.deleteMany({ where: { email: email(adresse) } });
}

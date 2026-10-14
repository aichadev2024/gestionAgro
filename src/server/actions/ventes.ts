"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { ErreurMetier, messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { annulerVente, creerVente } from "@/server/services/ventes";

const ROLES_CAISSE = ["ADMIN", "GERANT", "CAISSIER"] as const;
const ROLES_SENSIBLES = ["ADMIN", "GERANT"] as const;

const entierPositif = z.number().int("Montant entier (FCFA)").min(0);

const venteSchema = z.object({
  clientId: z.string().optional(),
  depotId: z.string().optional(),
  remise: entierPositif,
  lignes: z
    .array(
      z.object({
        produitId: z.string().min(1),
        quantite: z
          .string()
          .regex(/^\d+([.,]\d{1,3})?$/, "Quantité invalide (3 décimales max)")
          .transform((v) => v.replace(",", ".")),
      }),
    )
    .min(1, "Le panier est vide"),
  paiements: z.array(
    z.object({
      mode: z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY", "CREDIT"]),
      montant: entierPositif,
    }),
  ),
});

export type ResultatVente = { erreur?: string; id?: string };

export async function validerVente(payload: z.input<typeof venteSchema>): Promise<ResultatVente> {
  try {
    const user = await exigerRole(...ROLES_CAISSE);
    const data = venteSchema.parse(payload);
    // Remise : réservée au gérant et à l'administrateur.
    if (data.remise > 0 && !ROLES_SENSIBLES.some((r) => r === user.role)) {
      throw new ErreurMetier("Seul un gérant ou un administrateur peut accorder une remise.");
    }
    const vente = await creerVente(user.id, data);
    revalidatePath("/ventes");
    revalidatePath("/");
    return { id: vente.id };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function creerClient(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_CAISSE);
    const data = z
      .object({
        nom: z.string().trim().min(1, "Nom requis").max(120),
        telephone: z.string().trim().max(30).optional(),
        plafondCredit: z.coerce.number().int().min(0),
      })
      .parse({
        nom: fd.get("nom"),
        telephone: fd.get("telephone") || undefined,
        plafondCredit: fd.get("plafondCredit") || 0,
      });
    // Le plafond de crédit ne se fixe que par un gérant ou un administrateur.
    if (!ROLES_SENSIBLES.some((r) => r === user.role)) data.plafondCredit = 0;
    await prisma.client.create({ data });
    revalidatePath("/ventes");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function annulerVenteAction(
  venteId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_SENSIBLES);
    await annulerVente(user.id, venteId, String(fd.get("motif") ?? ""));
    revalidatePath("/ventes");
    revalidatePath(`/ventes/${venteId}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

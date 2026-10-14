"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { annulerProduction, creerRecette, produire } from "@/server/services/production";

const ROLES_PRODUCTION = ["ADMIN", "GERANT", "RESPONSABLE_PRODUCTION"] as const;

const quantite = z
  .string()
  .regex(/^\d+([.,]\d{1,3})?$/, "Quantité invalide (3 décimales max)")
  .transform((v) => v.replace(",", "."));

const recetteSchema = z.object({
  nom: z.string().trim().min(1, "Nom requis").max(120),
  produitFiniId: z.string().min(1, "Choisissez le produit fini"),
  quantiteProduite: quantite,
  lignes: z
    .array(z.object({ produitId: z.string().min(1, "Matière requise"), quantite }))
    .min(1, "Ajoutez au moins une matière première"),
});

export async function creerRecetteAction(
  payload: z.input<typeof recetteSchema>,
): Promise<{ erreur?: string; ok?: boolean }> {
  try {
    await exigerRole(...ROLES_PRODUCTION);
    const d = recetteSchema.parse(payload);
    await creerRecette(d.nom, d.produitFiniId, d.quantiteProduite, d.lignes);
    revalidatePath("/production");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function lancerProduction(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_PRODUCTION);
    const d = z
      .object({
        recetteId: z.string().min(1, "Choisissez une recette"),
        multiplicateur: quantite,
        quantiteObtenue: quantite,
        numeroLot: z.string().trim().min(1, "Numéro de lot requis"),
        datePeremption: z.string().optional(),
      })
      .parse({
        recetteId: fd.get("recetteId"),
        multiplicateur: fd.get("multiplicateur"),
        quantiteObtenue: fd.get("quantiteObtenue"),
        numeroLot: fd.get("numeroLot"),
        datePeremption: String(fd.get("datePeremption") ?? "") || undefined,
      });
    await produire(
      user.id,
      d.recetteId,
      d.multiplicateur,
      d.quantiteObtenue,
      d.numeroLot,
      d.datePeremption,
      String(fd.get("depotId") ?? "") || undefined,
    );
    revalidatePath("/production");
    revalidatePath("/stocks");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function annulerProductionAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole("ADMIN", "GERANT");
    await annulerProduction(user.id, id, String(fd.get("motif") ?? ""));
    revalidatePath("/production");
    revalidatePath(`/production/${id}`);
    revalidatePath("/stocks");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

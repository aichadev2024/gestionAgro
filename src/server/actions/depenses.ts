"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { annulerDepense, CATEGORIES_DEPENSE, creerDepense } from "@/server/services/depenses";

const ROLES = ["ADMIN", "GERANT"] as const;

export async function creerDepenseAction(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES);
    const d = z
      .object({
        categorie: z.enum(CATEGORIES_DEPENSE),
        libelle: z.string().trim().min(1, "Libellé requis").max(200),
        montant: z.coerce.number().int("Montant entier (FCFA)").positive("Montant > 0"),
        mode: z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY"]),
        dateDepense: z.string().min(1, "Date requise"),
      })
      .parse({
        categorie: fd.get("categorie"),
        libelle: fd.get("libelle"),
        montant: fd.get("montant"),
        mode: fd.get("mode"),
        dateDepense: fd.get("dateDepense"),
      });
    await creerDepense(user.id, d);
    revalidatePath("/depenses");
    revalidatePath("/statistiques");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function annulerDepenseAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES);
    await annulerDepense(user.id, id, String(fd.get("motif") ?? ""));
    revalidatePath("/depenses");
    revalidatePath("/statistiques");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

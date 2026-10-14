"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { cloturerCaisse } from "@/server/services/clotures";

export async function cloturerCaisseAction(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole("ADMIN", "GERANT", "CAISSIER");
    const d = z
      .object({
        compte: z.coerce.number().int("Montant entier (FCFA)").min(0, "Montant positif"),
        note: z.string().trim().max(300).optional(),
      })
      .parse({ compte: fd.get("compte"), note: fd.get("note") || undefined });
    await cloturerCaisse(user.id, d.compte, d.note);
    revalidatePath("/caisse");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { formatFCFA } from "@/lib/format";
import { notifierEvenement } from "@/server/services/push";
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
    const cloture = await cloturerCaisse(user.id, d.compte, d.note);
    if (cloture.ecart !== 0) {
      void notifierEvenement(
        ["ADMIN", "GERANT"],
        {
          title: "Écart de caisse",
          body: `${user.name} : ${cloture.ecart > 0 ? "+" : ""}${formatFCFA(cloture.ecart)} (attendu ${formatFCFA(cloture.attendu)})`,
          url: "/caisse",
          tag: "ecart-caisse",
        },
        { exclure: user.id },
      );
    }
    revalidatePath("/caisse");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

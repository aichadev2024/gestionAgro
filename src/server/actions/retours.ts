"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { formatFCFA } from "@/lib/format";
import { notifierEvenement } from "@/server/services/push";
import { creerRetour } from "@/server/services/retours";

const quantite = z
  .string()
  .regex(/^\d+([.,]\d{1,3})?$/, "Quantité invalide (3 décimales max)")
  .transform((v) => v.replace(",", "."));

export async function creerRetourAction(
  venteId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    // Un remboursement est une action sensible : gérant et administrateur seulement.
    const user = await exigerRole("ADMIN", "GERANT");
    const ids = fd.getAll("ligneVenteId").map(String);
    const lignes = ids.map((ligneVenteId) => ({
      ligneVenteId,
      quantite: quantite.parse(String(fd.get(`quantite_${ligneVenteId}`) || "0")),
    }));
    const d = z
      .object({
        mode: z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY", "CREDIT"]),
        motif: z.string().trim().min(1, "Motif obligatoire").max(200),
      })
      .parse({ mode: fd.get("mode"), motif: fd.get("motif") });
    const retour = await creerRetour(user.id, venteId, lignes, d.mode, d.motif, fd.get("remisEnStock") === "on");
    void notifierEvenement(
      ["ADMIN", "GERANT"],
      {
        title: `Retour client : ${retour.numero}`,
        body: `${formatFCFA(retour.total)} remboursés par ${user.name} · ${d.motif}`,
        url: `/ventes/${venteId}`,
      },
      { exclure: user.id },
    );
    revalidatePath(`/ventes/${venteId}`);
    revalidatePath("/ventes");
    revalidatePath("/stocks");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

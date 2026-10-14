"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { encaisserCreance, modifierClient } from "@/server/services/clients";

const ROLES_CLIENTS = ["ADMIN", "GERANT", "CAISSIER"] as const;
const ROLES_PLAFOND = ["ADMIN", "GERANT"] as const;

export async function encaisserCreanceAction(
  clientId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_CLIENTS);
    const d = z
      .object({
        montant: z.coerce.number().int("Montant entier (FCFA)").positive("Montant > 0"),
        mode: z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY"]),
        note: z.string().trim().max(200).optional(),
      })
      .parse({
        montant: fd.get("montant"),
        mode: fd.get("mode"),
        note: fd.get("note") || undefined,
      });
    await encaisserCreance(user.id, clientId, d.montant, d.mode, d.note);
    revalidatePath("/clients");
    revalidatePath("/ventes");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function modifierClientAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_CLIENTS);
    const peutPlafond = ROLES_PLAFOND.some((r) => r === user.role);
    const d = z
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
    await modifierClient(id, {
      nom: d.nom,
      telephone: d.telephone,
      plafondCredit: peutPlafond ? d.plafondCredit : undefined,
    });
    revalidatePath("/clients");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

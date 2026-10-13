"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { declarerPerte, inventorierLot, transfererLot } from "@/server/services/stocks";

const ROLES_STOCK = ["ADMIN", "GERANT", "MAGASINIER"] as const;

const quantite = z
  .string()
  .regex(/^\d+([.,]\d{1,3})?$/, "Quantité invalide (3 décimales max)")
  .transform((v) => v.replace(",", "."));

const lotId = z.string().min(1, "Choisissez un lot");

function rafraichir() {
  revalidatePath("/stocks");
  revalidatePath("/");
}

export async function creerDepot(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    await exigerRole("ADMIN", "GERANT");
    const data = z
      .object({
        nom: z.string().trim().min(1, "Nom requis").max(80),
        adresse: z.string().trim().max(200).optional(),
      })
      .parse({ nom: fd.get("nom"), adresse: fd.get("adresse") || undefined });
    await prisma.depot.create({ data });
    rafraichir();
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function enregistrerPerte(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_STOCK);
    const d = z
      .object({ lotId, quantite, motif: z.string().trim().min(1, "Motif obligatoire") })
      .parse({ lotId: fd.get("lotId"), quantite: fd.get("quantite"), motif: fd.get("motif") });
    await declarerPerte(user.id, d.lotId, d.quantite, d.motif);
    rafraichir();
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function enregistrerInventaire(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    // Un ajustement de stock est une action sensible : gérant et administrateur seulement.
    const user = await exigerRole("ADMIN", "GERANT");
    const d = z
      .object({ lotId, quantite, motif: z.string().trim() })
      .parse({ lotId: fd.get("lotId"), quantite: fd.get("quantite"), motif: fd.get("motif") ?? "" });
    await inventorierLot(user.id, d.lotId, d.quantite, d.motif);
    rafraichir();
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function enregistrerTransfert(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_STOCK);
    const d = z
      .object({ lotId, depotId: z.string().min(1, "Choisissez le dépôt"), quantite })
      .parse({
        lotId: fd.get("lotId"),
        depotId: fd.get("depotId"),
        quantite: fd.get("quantite"),
      });
    await transfererLot(user.id, d.lotId, d.depotId, d.quantite);
    rafraichir();
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

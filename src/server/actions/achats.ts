"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import {
  annulerAchat,
  creerBonDeCommande,
  modifierFournisseur,
  payerAchat,
  receptionner,
} from "@/server/services/achats";

const ROLES_ACHATS = ["ADMIN", "GERANT", "MAGASINIER"] as const;
const ROLES_ANNULATION = ["ADMIN", "GERANT"] as const;

const quantite = z
  .string()
  .regex(/^\d+([.,]\d{1,3})?$/, "Quantité invalide (3 décimales max)")
  .transform((v) => v.replace(",", "."));

export async function creerFournisseur(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_ACHATS);
    const data = z
      .object({
        nom: z.string().trim().min(1, "Nom requis").max(120),
        telephone: z.string().trim().max(30).optional(),
        adresse: z.string().trim().max(200).optional(),
      })
      .parse({
        nom: fd.get("nom"),
        telephone: fd.get("telephone") || undefined,
        adresse: fd.get("adresse") || undefined,
      });
    await prisma.fournisseur.create({ data });
    revalidatePath("/achats");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

const commandeSchema = z.object({
  fournisseurId: z.string().min(1, "Choisissez un fournisseur"),
  lignes: z
    .array(
      z.object({
        produitId: z.string().min(1, "Produit requis"),
        quantite: quantite.refine((q) => Number(q) > 0, "Quantité > 0"),
        prixUnitaire: z.number().int("Prix entier (FCFA)").min(0),
      }),
    )
    .min(1, "Ajoutez au moins une ligne"),
});

export type ResultatCommande = { erreur?: string; id?: string };

export async function creerCommande(
  payload: z.input<typeof commandeSchema>,
): Promise<ResultatCommande> {
  try {
    const user = await exigerRole(...ROLES_ACHATS);
    const data = commandeSchema.parse(payload);
    const achat = await creerBonDeCommande(user.id, data.fournisseurId, data.lignes);
    revalidatePath("/achats");
    return { id: achat.id };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function receptionnerCommande(
  achatId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_ACHATS);
    const ids = fd.getAll("ligneId").map(String);
    const lignes = ids.map((ligneId) => ({
      ligneId,
      quantite: quantite.parse(String(fd.get(`quantite_${ligneId}`) || "0")),
      numeroLot: String(fd.get(`lot_${ligneId}`) ?? ""),
      datePeremption: String(fd.get(`peremption_${ligneId}`) ?? "") || undefined,
    }));
    await receptionner(user.id, achatId, lignes, String(fd.get("depotId") ?? "") || undefined);
    revalidatePath("/achats");
    revalidatePath(`/achats/${achatId}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function annulerCommande(
  achatId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_ANNULATION);
    await annulerAchat(user.id, achatId, String(fd.get("motif") ?? ""));
    revalidatePath("/achats");
    revalidatePath(`/achats/${achatId}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function payerCommandeAction(
  achatId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole("ADMIN", "GERANT");
    const d = z
      .object({
        montant: z.coerce.number().int("Montant entier (FCFA)").positive("Montant > 0"),
        mode: z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY"]),
      })
      .parse({ montant: fd.get("montant"), mode: fd.get("mode") });
    await payerAchat(user.id, achatId, d.montant, d.mode);
    revalidatePath("/achats");
    revalidatePath(`/achats/${achatId}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function modifierFournisseurAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_ACHATS);
    const d = z
      .object({
        nom: z.string().trim().min(1, "Nom requis").max(120),
        telephone: z.string().trim().max(30).optional(),
        adresse: z.string().trim().max(200).optional(),
      })
      .parse({
        nom: fd.get("nom"),
        telephone: fd.get("telephone") || undefined,
        adresse: fd.get("adresse") || undefined,
      });
    await modifierFournisseur(id, d);
    revalidatePath("/achats");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

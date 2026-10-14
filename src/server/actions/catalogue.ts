"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";

const ROLES_CATALOGUE = ["ADMIN", "GERANT", "MAGASINIER"] as const;
const ROLES_PRIX = ["ADMIN", "GERANT"] as const;

const entier = z.coerce.number().int("Entier requis").min(0, "Doit être positif");
const decimal = z.coerce.number().min(0, "Doit être positif");

const nomSchema = z.object({ nom: z.string().trim().min(1, "Nom requis").max(80) });

export async function creerCategorie(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_CATALOGUE);
    const { nom } = nomSchema.parse({ nom: fd.get("nom") });
    await prisma.categorie.create({ data: { nom } });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

const uniteSchema = nomSchema.extend({
  symbole: z.string().trim().min(1, "Symbole requis").max(10),
});

export async function creerUnite(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_CATALOGUE);
    const data = uniteSchema.parse({ nom: fd.get("nom"), symbole: fd.get("symbole") });
    await prisma.unite.create({ data });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

const produitSchema = z.object({
  code: z.string().trim().min(1, "Code requis").max(30).toUpperCase(),
  nom: z.string().trim().min(1, "Nom requis").max(120),
  codeBarres: z.string().trim().max(50).optional(),
  categorieId: z.string().min(1, "Catégorie requise"),
  uniteId: z.string().min(1, "Unité requise"),
  prixAchat: entier,
  prixVente: entier,
  seuilAlerte: decimal,
  perissable: z.boolean(),
});

function lireProduit(fd: FormData) {
  return produitSchema.parse({
    code: fd.get("code"),
    nom: fd.get("nom"),
    codeBarres: String(fd.get("codeBarres") ?? "").trim() || undefined,
    categorieId: fd.get("categorieId"),
    uniteId: fd.get("uniteId"),
    prixAchat: fd.get("prixAchat") || 0,
    prixVente: fd.get("prixVente") || 0,
    seuilAlerte: fd.get("seuilAlerte") || 0,
    perissable: fd.get("perissable") === "on",
  });
}

export async function creerProduit(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_CATALOGUE);
    const data = lireProduit(fd);
    // Les prix ne sont fixés que par un gérant ou un administrateur.
    if (!ROLES_PRIX.some((r) => r === user.role)) {
      data.prixAchat = 0;
      data.prixVente = 0;
    }
    const produit = await prisma.produit.create({ data });
    await prisma.journalAction.create({
      data: {
        auteurId: user.id,
        action: "CREATION_PRODUIT",
        entite: "Produit",
        entiteId: produit.id,
        detail: { code: data.code, prixAchat: data.prixAchat, prixVente: data.prixVente },
      },
    });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function modifierProduit(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(...ROLES_CATALOGUE);
    const data = lireProduit(fd);
    const avant = await prisma.produit.findUniqueOrThrow({ where: { id } });

    const prixChange = avant.prixAchat !== data.prixAchat || avant.prixVente !== data.prixVente;
    // Seuls l'admin et le gérant peuvent modifier les prix.
    if (prixChange && !ROLES_PRIX.some((r) => r === user.role)) {
      return { erreur: "Seul un gérant ou un administrateur peut modifier les prix." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.produit.update({ where: { id }, data: { ...data, codeBarres: data.codeBarres ?? null } });
      if (prixChange) {
        await tx.journalAction.create({
          data: {
            auteurId: user.id,
            action: "MODIFICATION_PRIX",
            entite: "Produit",
            entiteId: id,
            detail: {
              prixAchat: [avant.prixAchat, data.prixAchat],
              prixVente: [avant.prixVente, data.prixVente],
            },
          },
        });
      }
    });
    revalidatePath("/catalogue");
    revalidatePath(`/catalogue/${id}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function basculerActifProduit(id: string) {
  const user = await exigerRole(...ROLES_CATALOGUE);
  const p = await prisma.produit.findUniqueOrThrow({ where: { id } });
  // Pas de suppression physique : on désactive.
  await prisma.$transaction([
    prisma.produit.update({ where: { id }, data: { actif: !p.actif } }),
    prisma.journalAction.create({
      data: {
        auteurId: user.id,
        action: p.actif ? "DESACTIVATION_PRODUIT" : "REACTIVATION_PRODUIT",
        entite: "Produit",
        entiteId: id,
      },
    }),
  ]);
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${id}`);
}

const conditionnementSchema = z.object({
  nom: z.string().trim().min(1, "Nom requis").max(60),
  quantite: z.coerce.number().gt(0, "Quantité > 0"),
  prixVente: z.preprocess((v) => (v === "" || v == null ? undefined : v), entier.optional()),
});

export async function ajouterConditionnement(
  produitId: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_CATALOGUE);
    const data = conditionnementSchema.parse({
      nom: fd.get("nom"),
      quantite: fd.get("quantite"),
      prixVente: fd.get("prixVente"),
    });
    await prisma.conditionnement.create({ data: { ...data, produitId } });
    revalidatePath(`/catalogue/${produitId}`);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function supprimerConditionnement(produitId: string, id: string) {
  await exigerRole(...ROLES_CATALOGUE);
  await prisma.conditionnement.delete({ where: { id } });
  revalidatePath(`/catalogue/${produitId}`);
}

export async function modifierCategorie(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_CATALOGUE);
    const { nom } = nomSchema.parse({ nom: fd.get("nom") });
    await prisma.categorie.update({ where: { id }, data: { nom } });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function modifierUnite(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    await exigerRole(...ROLES_CATALOGUE);
    const data = uniteSchema.parse({ nom: fd.get("nom"), symbole: fd.get("symbole") });
    await prisma.unite.update({ where: { id }, data });
    revalidatePath("/catalogue");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

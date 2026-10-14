"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { ErreurMetier, messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { creerTransport, envoyerEmailTest } from "@/server/services/alertes-email";
import {
  basculerActif,
  changerMonMotDePasse,
  changerRole,
  creerUtilisateur,
  reinitialiserMotDePasse,
} from "@/server/services/utilisateurs";

const role = z.enum(ROLES);

export async function creerUtilisateurAction(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const admin = await exigerRole("ADMIN");
    const d = z
      .object({
        nom: z.string().trim().min(1, "Nom requis").max(120),
        email: z.string().trim().email("Email invalide"),
        role,
        motDePasse: z.string(),
      })
      .parse({
        nom: fd.get("nom"),
        email: fd.get("email"),
        role: fd.get("role"),
        motDePasse: fd.get("motDePasse"),
      });
    await creerUtilisateur(admin.id, d);
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function changerRoleAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const admin = await exigerRole("ADMIN");
    await changerRole(admin.id, id, role.parse(fd.get("role")));
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function basculerActifAction(id: string): Promise<EtatFormulaire> {
  try {
    const admin = await exigerRole("ADMIN");
    await basculerActif(admin.id, id);
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function reinitialiserMdpAction(
  id: string,
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const admin = await exigerRole("ADMIN");
    await reinitialiserMotDePasse(admin.id, id, String(fd.get("motDePasse") ?? ""));
    revalidatePath("/utilisateurs");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function changerMonMotDePasseAction(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(); // tout utilisateur connecté
    const nouveau = String(fd.get("nouveau") ?? "");
    if (nouveau !== String(fd.get("confirmation") ?? "")) {
      throw new ErreurMetier("La confirmation ne correspond pas au nouveau mot de passe.");
    }
    await changerMonMotDePasse(user.id, String(fd.get("actuel") ?? ""), nouveau);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function preferenceAlertesAction(
  _: EtatFormulaire,
  fd: FormData,
): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole();
    await prisma.user.update({
      where: { id: user.id },
      data: { recoitAlertes: fd.get("recoitAlertes") === "on" },
    });
    revalidatePath("/profil");
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function envoyerEmailTestAction(): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole();
    const smtp = creerTransport();
    if (!smtp) {
      throw new ErreurMetier(
        "L'envoi d'emails n'est pas encore configuré sur le serveur (variables SMTP_*). Voir DEPLOIEMENT.md.",
      );
    }
    await envoyerEmailTest(smtp.transport, smtp.expediteur, user.email, user.name);
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

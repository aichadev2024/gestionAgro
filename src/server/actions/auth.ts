"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { compteBloque, FENETRE_MIN } from "@/server/services/connexion";

export async function connexion(_etat: string | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (email && (await compteBloque(email))) {
    return `Trop de tentatives. Réessayez dans ${FENETRE_MIN} minutes ou contactez votre administrateur.`;
  }
  try {
    await signIn("credentials", {
      email,
      motDePasse: formData.get("motDePasse"),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) return "Email ou mot de passe incorrect.";
    throw e;
  }
}

export async function deconnexion() {
  await signOut({ redirectTo: "/login" });
}

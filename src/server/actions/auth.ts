"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export async function connexion(_etat: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
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

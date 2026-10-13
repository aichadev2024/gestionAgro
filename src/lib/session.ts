import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

/**
 * Utilisateur connecté, relu en base : un compte désactivé ou dont le rôle a changé
 * est pris en compte immédiatement, sans attendre l'expiration du jeton de session.
 */
export const utilisateurCourant = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, nom: true, email: true, role: true, actif: true },
  });
  if (!u || !u.actif) return null;
  return { id: u.id, name: u.nom, email: u.email, role: u.role as Role };
});

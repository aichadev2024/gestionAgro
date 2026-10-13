import { ErreurMetier } from "@/lib/erreurs";
import type { Role } from "@/lib/roles";
import { utilisateurCourant } from "@/lib/session";

/** À appeler au début de chaque Server Action : vérifie la session et le rôle côté serveur. */
export async function exigerRole(...roles: Role[]) {
  const user = await utilisateurCourant();
  if (!user) throw new ErreurMetier("Non authentifié");
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new ErreurMetier("Droits insuffisants");
  }
  return user;
}

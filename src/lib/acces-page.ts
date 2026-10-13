import { redirect } from "next/navigation";
import { accueilPourRole, MENU } from "@/lib/roles";
import { utilisateurCourant } from "@/lib/session";

/** Garde de page côté serveur : redirige si le rôle n'a pas accès au module. */
export async function exigerAccesModule(href: string) {
  const user = await utilisateurCourant();
  if (!user) redirect("/deconnexion");
  const entree = MENU.find((m) => m.href === href);
  if (entree && !entree.roles.includes(user.role)) redirect(accueilPourRole(user.role));
  return user;
}

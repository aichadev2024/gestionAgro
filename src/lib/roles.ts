export const ROLES = [
  "ADMIN",
  "GERANT",
  "MAGASINIER",
  "CAISSIER",
  "RESPONSABLE_PRODUCTION",
] as const;
export type Role = (typeof ROLES)[number];

export const LIBELLE_ROLE: Record<Role, string> = {
  ADMIN: "Administrateur",
  GERANT: "Gérant",
  MAGASINIER: "Magasinier",
  CAISSIER: "Caissier",
  RESPONSABLE_PRODUCTION: "Resp. production",
};

export type ModuleMenu = { href: string; libelle: string; roles: Role[] };

export const MENU: ModuleMenu[] = [
  { href: "/", libelle: "Tableau de bord", roles: ["ADMIN", "GERANT"] },
  { href: "/ventes", libelle: "Ventes", roles: ["ADMIN", "GERANT", "CAISSIER"] },
  { href: "/achats", libelle: "Achats", roles: ["ADMIN", "GERANT", "MAGASINIER"] },
  { href: "/stocks", libelle: "Stocks", roles: ["ADMIN", "GERANT", "MAGASINIER"] },
  { href: "/catalogue", libelle: "Catalogue", roles: ["ADMIN", "GERANT", "MAGASINIER"] },
  { href: "/production", libelle: "Production", roles: ["ADMIN", "GERANT", "RESPONSABLE_PRODUCTION"] },
  { href: "/statistiques", libelle: "Statistiques", roles: ["ADMIN", "GERANT"] },
  { href: "/utilisateurs", libelle: "Utilisateurs", roles: ["ADMIN"] },
];

export function menuPourRole(role: Role) {
  return MENU.filter((m) => m.roles.includes(role));
}

/** Page d'accueil selon le rôle (le caissier n'a pas de tableau de bord). */
export function accueilPourRole(role: Role) {
  return menuPourRole(role)[0]?.href ?? "/login";
}

import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Jeu de données minimal : utilisateurs de chaque rôle, un dépôt, une catégorie, des unités. */
export async function base() {
  const users: Record<string, string> = {};
  for (const role of ["ADMIN", "GERANT", "MAGASINIER", "CAISSIER", "RESPONSABLE_PRODUCTION"] as Role[]) {
    users[role] = (
      await prisma.user.create({
        data: { nom: role, email: `${role.toLowerCase()}@test.local`, role, motDePasse: "x" },
      })
    ).id;
  }
  const depot = await prisma.depot.create({ data: { nom: "Dépôt A" } });
  const categorie = await prisma.categorie.create({ data: { nom: "Céréales" } });
  const kg = await prisma.unite.create({ data: { nom: "Kilogramme", symbole: "kg" } });
  return { users, depot, categorie, kg };
}

type Ctx = Awaited<ReturnType<typeof base>>;

export async function produit(
  c: Ctx,
  code: string,
  opts: { prixVente?: number; prixAchat?: number; perissable?: boolean; seuilAlerte?: number } = {},
) {
  return prisma.produit.create({
    data: {
      code,
      nom: `Produit ${code}`,
      categorieId: c.categorie.id,
      uniteId: c.kg.id,
      prixVente: opts.prixVente ?? 500,
      prixAchat: opts.prixAchat ?? 300,
      perissable: opts.perissable ?? false,
      seuilAlerte: opts.seuilAlerte ?? 0,
    },
  });
}

export async function lot(
  c: Ctx,
  produitId: string,
  numeroLot: string,
  quantite: number,
  opts: { peremption?: string; prixAchat?: number; depotId?: string } = {},
) {
  return prisma.lot.create({
    data: {
      produitId,
      depotId: opts.depotId ?? c.depot.id,
      numeroLot,
      datePeremption: opts.peremption ? new Date(opts.peremption) : null,
      quantiteInitiale: quantite,
      quantiteRestante: quantite,
      prixAchat: opts.prixAchat ?? 300,
    },
  });
}

export async function restant(lotId: string) {
  return (await prisma.lot.findUniqueOrThrow({ where: { id: lotId } })).quantiteRestante.toNumber();
}

/** Date relative à aujourd'hui, au format AAAA-MM-JJ. */
export function dans(jours: number) {
  return new Date(Date.now() + jours * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

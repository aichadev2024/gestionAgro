import { prisma } from "@/lib/prisma";

export function listerCategories() {
  return prisma.categorie.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { produits: true } } },
  });
}

export function listerUnites() {
  return prisma.unite.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { produits: true } } },
  });
}

export function listerProduits() {
  return prisma.produit.findMany({
    orderBy: [{ actif: "desc" }, { nom: "asc" }],
    include: { categorie: true, unite: true },
  });
}

export function trouverProduit(id: string) {
  return prisma.produit.findUnique({
    where: { id },
    include: {
      categorie: true,
      unite: true,
      conditionnements: { orderBy: { quantite: "asc" } },
    },
  });
}

export function rechercherProduits(recherche?: string, page = 1, parPage = 25) {
  const where = recherche
    ? {
        OR: [
          { nom: { contains: recherche, mode: "insensitive" as const } },
          { code: { contains: recherche, mode: "insensitive" as const } },
          { codeBarres: { contains: recherche } },
          { categorie: { nom: { contains: recherche, mode: "insensitive" as const } } },
        ],
      }
    : {};
  return Promise.all([
    prisma.produit.findMany({
      where,
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      skip: (page - 1) * parPage,
      take: parPage,
      include: { categorie: true, unite: true },
    }),
    prisma.produit.count({ where }),
  ]);
}

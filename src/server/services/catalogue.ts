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

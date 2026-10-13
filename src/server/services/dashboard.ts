import { prisma } from "@/lib/prisma";

export async function indicateursDuJour() {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const dans30j = new Date(debut.getTime() + 30 * 24 * 3600 * 1000);

  const [ventes, achatsEnCours, lotsProchesPeremption, stockParProduit, produits] =
    await Promise.all([
      prisma.vente.aggregate({
        where: { statut: "VALIDEE", creeLe: { gte: debut } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.achat.count({ where: { statut: { in: ["COMMANDE", "RECU_PARTIEL"] } } }),
      prisma.lot.count({
        where: { quantiteRestante: { gt: 0 }, datePeremption: { lte: dans30j } },
      }),
      prisma.lot.groupBy({ by: ["produitId"], _sum: { quantiteRestante: true } }),
      prisma.produit.findMany({
        where: { actif: true, seuilAlerte: { gt: 0 } },
        select: { id: true, seuilAlerte: true },
      }),
    ]);

  const stock = new Map(stockParProduit.map((s) => [s.produitId, s._sum.quantiteRestante]));
  const stockBas = produits.filter((p) => {
    const q = stock.get(p.id);
    return (q ? q.toNumber() : 0) <= p.seuilAlerte.toNumber();
  }).length;

  return {
    nbVentes: ventes._count,
    montantVentes: ventes._sum.total ?? 0,
    achatsEnCours,
    lotsProchesPeremption,
    stockBas,
  };
}

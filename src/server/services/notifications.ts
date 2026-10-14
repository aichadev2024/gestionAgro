import { prisma } from "@/lib/prisma";
import { formatDate, formatFCFA } from "@/lib/format";
import type { Role } from "@/lib/roles";
import { resteAPayer } from "@/server/services/achats";
import { journee } from "@/server/services/clotures";
import { etatStock } from "@/server/services/stocks";

export type Niveau = "critique" | "attention" | "info";
export type Notification = {
  id: string;
  niveau: Niveau;
  categorie: "Stock" | "Achats" | "Clients" | "Caisse" | "Production";
  titre: string;
  detail: string;
  href: string;
};

const JOUR = 24 * 3600 * 1000;
const ORDRE: Record<Niveau, number> = { critique: 0, attention: 1, info: 2 };

const GERE_STOCK: Role[] = ["ADMIN", "GERANT", "MAGASINIER"];
const GERE_ARGENT: Role[] = ["ADMIN", "GERANT"];

/**
 * Alertes calculées à la demande : elles reflètent l'état actuel des données
 * et disparaissent d'elles-mêmes quand le problème est résolu.
 */
export async function notificationsPour(user: { id: string; role: Role }): Promise<Notification[]> {
  const liste: Notification[] = [];
  const ajouter = (n: Notification) => liste.push(n);
  const maintenant = Date.now();

  // ───── Stock : stock bas, lots périmés, péremptions proches ─────
  if (GERE_STOCK.includes(user.role)) {
    const etat = await etatStock();
    const bas = etat.parProduit.filter((p) => p.stockBas);
    if (bas.length > 0) {
      ajouter({
        id: "stock-bas",
        niveau: "attention",
        categorie: "Stock",
        titre: `${bas.length} produit(s) en stock bas`,
        detail: bas
          .slice(0, 5)
          .map((p) => `${p.produit.nom} (${p.total.toString()} ${p.produit.unite.symbole})`)
          .join(", ") + (bas.length > 5 ? "…" : ""),
        href: "/stocks",
      });
    }
    if (etat.perimes.length > 0) {
      ajouter({
        id: "lots-perimes",
        niveau: "critique",
        categorie: "Stock",
        titre: `${etat.perimes.length} lot(s) périmé(s) encore en stock`,
        detail: "Déclarez une perte pour les sortir du stock : ils ne peuvent plus être vendus.",
        href: "/stocks",
      });
    }
    if (etat.bientot.length > 0) {
      ajouter({
        id: "peremption-proche",
        niveau: "attention",
        categorie: "Stock",
        titre: `${etat.bientot.length} lot(s) périment dans moins de 30 jours`,
        detail: etat.bientot
          .slice(0, 4)
          .map((l) => `${l.produit.nom} lot ${l.numeroLot} (${formatDate(l.datePeremption!)})`)
          .join(", "),
        href: "/stocks",
      });
    }

    const enRetard = await prisma.achat.findMany({
      where: {
        statut: { in: ["COMMANDE", "RECU_PARTIEL"] },
        creeLe: { lt: new Date(maintenant - 7 * JOUR) },
      },
      include: { fournisseur: { select: { nom: true } } },
      orderBy: { creeLe: "asc" },
    });
    if (enRetard.length > 0) {
      ajouter({
        id: "commandes-en-retard",
        niveau: "attention",
        categorie: "Achats",
        titre: `${enRetard.length} commande(s) non (entièrement) reçue(s) depuis plus de 7 jours`,
        detail: enRetard
          .slice(0, 4)
          .map((a) => `${a.numero} (${a.fournisseur.nom})`)
          .join(", "),
        href: "/achats",
      });
    }
  }

  // ───── Argent : créances, dettes, caisse ─────
  if (GERE_ARGENT.includes(user.role)) {
    const clients = await prisma.client.findMany({ where: { solde: { gt: 0 } }, orderBy: { solde: "desc" } });
    const procheDuPlafond = clients.filter((c) => c.plafondCredit > 0 && c.solde >= c.plafondCredit * 0.8);
    if (procheDuPlafond.length > 0) {
      ajouter({
        id: "plafond-proche",
        niveau: "attention",
        categorie: "Clients",
        titre: `${procheDuPlafond.length} client(s) proche(s) de leur plafond de crédit`,
        detail: procheDuPlafond
          .slice(0, 4)
          .map((c) => `${c.nom} (${formatFCFA(c.solde)} / ${formatFCFA(c.plafondCredit)})`)
          .join(", "),
        href: "/clients",
      });
    }
    if (clients.length > 0) {
      ajouter({
        id: "creances",
        niveau: "info",
        categorie: "Clients",
        titre: `${clients.length} client(s) doivent de l'argent`,
        detail: `Total à récupérer : ${formatFCFA(clients.reduce((s, c) => s + c.solde, 0))}.`,
        href: "/clients",
      });
    }

    const achats = await prisma.achat.findMany({
      where: { statut: { not: "ANNULE" }, creeLe: { lt: new Date(maintenant - 30 * JOUR) } },
      include: { paiements: { select: { montant: true } }, fournisseur: { select: { nom: true } } },
    });
    const impayes = achats.filter((a) => resteAPayer(a) > 0);
    if (impayes.length > 0) {
      ajouter({
        id: "dettes-anciennes",
        niveau: "attention",
        categorie: "Achats",
        titre: `${impayes.length} commande(s) impayée(s) depuis plus de 30 jours`,
        detail: `Reste à payer : ${formatFCFA(impayes.reduce((s, a) => s + resteAPayer(a), 0))} (${[
          ...new Set(impayes.map((a) => a.fournisseur.nom)),
        ]
          .slice(0, 3)
          .join(", ")}).`,
        href: "/achats",
      });
    }

    // Caisses d'un jour passé jamais clôturées, et écarts récents.
    const { debut: aujourdhui } = journee();
    const depuis = new Date(aujourdhui.getTime() - 3 * JOUR);
    const [ventes, clotures, ecarts] = await Promise.all([
      prisma.vente.findMany({
        where: { statut: "VALIDEE", creeLe: { gte: depuis, lt: aujourdhui } },
        select: { creeLe: true, caissierId: true, caissier: { select: { nom: true } } },
      }),
      prisma.clotureCaisse.findMany({ where: { jour: { gte: depuis } }, select: { jour: true, creeParId: true } }),
      prisma.clotureCaisse.findMany({
        where: { ecart: { not: 0 }, creeLe: { gte: new Date(maintenant - 7 * JOUR) } },
        orderBy: { creeLe: "desc" },
      }),
    ]);
    const clotureesSet = new Set(clotures.map((c) => `${formatDate(c.jour)}|${c.creeParId}`));
    const manquantes = new Map<string, string>();
    for (const v of ventes) {
      const cle = `${formatDate(v.creeLe)}|${v.caissierId}`;
      if (!clotureesSet.has(cle)) manquantes.set(cle, `${v.caissier.nom} (${formatDate(v.creeLe)})`);
    }
    if (manquantes.size > 0) {
      ajouter({
        id: "clotures-manquantes",
        niveau: "attention",
        categorie: "Caisse",
        titre: `${manquantes.size} clôture(s) de caisse manquante(s)`,
        detail: [...manquantes.values()].slice(0, 4).join(", "),
        href: "/caisse",
      });
    }
    if (ecarts.length > 0) {
      ajouter({
        id: "ecarts-caisse",
        niveau: "critique",
        categorie: "Caisse",
        titre: `${ecarts.length} écart(s) de caisse cette semaine`,
        detail: ecarts
          .slice(0, 4)
          .map((e) => `${formatDate(e.jour)} : ${e.ecart > 0 ? "+" : ""}${formatFCFA(e.ecart)}`)
          .join(", "),
        href: "/caisse",
      });
    }
  }

  // ───── Caissier : sa propre caisse du jour ─────
  if (user.role === "CAISSIER") {
    const { debut, fin } = journee();
    const [ventesDuJour, cloture] = await Promise.all([
      prisma.vente.count({
        where: { statut: "VALIDEE", caissierId: user.id, creeLe: { gte: debut, lt: fin } },
      }),
      prisma.clotureCaisse.findUnique({ where: { jour_creeParId: { jour: debut, creeParId: user.id } } }),
    ]);
    if (ventesDuJour > 0 && !cloture) {
      ajouter({
        id: "ma-caisse",
        niveau: "info",
        categorie: "Caisse",
        titre: "Pensez à clôturer votre caisse en fin de journée",
        detail: `${ventesDuJour} vente(s) enregistrée(s) aujourd'hui.`,
        href: "/caisse",
      });
    }
  }

  // ───── Production : recettes impossibles faute de matières ─────
  if (user.role === "RESPONSABLE_PRODUCTION" || GERE_ARGENT.includes(user.role)) {
    const aujourdhui = journee().debut;
    const [recettes, stocks] = await Promise.all([
      prisma.recette.findMany({
        where: { actif: true },
        include: { lignes: { include: { produit: { include: { unite: true } } } } },
      }),
      prisma.lot.groupBy({
        by: ["produitId"],
        where: {
          quantiteRestante: { gt: 0 },
          OR: [{ datePeremption: null }, { datePeremption: { gte: aujourdhui } }],
        },
        _sum: { quantiteRestante: true },
      }),
    ]);
    const dispo = new Map(stocks.map((s) => [s.produitId, s._sum.quantiteRestante?.toNumber() ?? 0]));
    for (const r of recettes) {
      const manque = r.lignes.filter((l) => (dispo.get(l.produitId) ?? 0) < l.quantite.toNumber());
      if (manque.length > 0) {
        ajouter({
          id: `recette-${r.id}`,
          niveau: "info",
          categorie: "Production",
          titre: `Recette « ${r.nom} » impossible : matières insuffisantes`,
          detail: manque
            .map((l) => `${l.produit.nom} (${dispo.get(l.produitId) ?? 0} ${l.produit.unite.symbole} pour ${l.quantite.toString()} requis)`)
            .join(", "),
          href: "/production",
        });
      }
    }
  }

  return liste.sort((a, b) => ORDRE[a.niveau] - ORDRE[b.niveau]);
}

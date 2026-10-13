import { prisma } from "@/lib/prisma";

// ───────────────────────── Périodes ─────────────────────────

export type Periode =
  | { vue: "mois"; annee: number; mois: number } // mois : 1 à 12
  | { vue: "annee"; annee: number };

export const NOMS_MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function bornes(p: Periode): { debut: Date; fin: Date } {
  return p.vue === "mois"
    ? { debut: new Date(p.annee, p.mois - 1, 1), fin: new Date(p.annee, p.mois, 1) }
    : { debut: new Date(p.annee, 0, 1), fin: new Date(p.annee + 1, 0, 1) };
}

export function periodePrecedente(p: Periode): Periode {
  if (p.vue === "annee") return { vue: "annee", annee: p.annee - 1 };
  return p.mois === 1
    ? { vue: "mois", annee: p.annee - 1, mois: 12 }
    : { vue: "mois", annee: p.annee, mois: p.mois - 1 };
}

export function periodeSuivante(p: Periode): Periode {
  if (p.vue === "annee") return { vue: "annee", annee: p.annee + 1 };
  return p.mois === 12
    ? { vue: "mois", annee: p.annee + 1, mois: 1 }
    : { vue: "mois", annee: p.annee, mois: p.mois + 1 };
}

export function libellePeriode(p: Periode) {
  return p.vue === "mois" ? `${NOMS_MOIS[p.mois - 1]} ${p.annee}` : `Année ${p.annee}`;
}

// ───────────────────────── Calculs ─────────────────────────

export type Resume = {
  nbVentes: number;
  ca: number; // chiffre d'affaires net (après remises)
  remises: number;
  cmv: number; // coût d'achat des marchandises vendues
  marge: number; // marge brute
  tauxMarge: number; // en %
  panierMoyen: number;
  encaisse: number; // espèces + mobile money
  credits: number; // vendu à crédit
  achats: number; // bons de commande non annulés
  nbAchats: number;
  pertes: number; // valeur des pertes déclarées
  ecartInventaire: number; // valeur signée des écarts d'inventaire
  nbProductions: number;
  coutProduction: number;
  resultat: number; // gain net estimé
};

export type Point = { label: string; ca: number; marge: number; achats: number };
export type Classement = { nom: string; ca: number; marge: number; quantite: number };

export type StatsPeriode = {
  resume: Resume;
  serie: Point[];
  topProduits: Classement[];
  categories: Classement[];
  caissiers: { nom: string; nb: number; ca: number }[];
  clients: { nom: string; nb: number; ca: number }[];
  modes: { mode: string; montant: number }[];
};

function creerSerie(p: Periode): Point[] {
  if (p.vue === "annee") {
    return NOMS_MOIS.map((m) => ({ label: m.slice(0, 3), ca: 0, marge: 0, achats: 0 }));
  }
  const nbJours = new Date(p.annee, p.mois, 0).getDate();
  return Array.from({ length: nbJours }, (_, i) => ({
    label: String(i + 1),
    ca: 0,
    marge: 0,
    achats: 0,
  }));
}

const indexDans = (p: Periode, d: Date) => (p.vue === "annee" ? d.getMonth() : d.getDate() - 1);

export async function statistiquesPeriode(p: Periode): Promise<StatsPeriode> {
  const { debut, fin } = bornes(p);
  const dansPeriode = { gte: debut, lt: fin };

  const [ventes, achats, mouvements, productions] = await Promise.all([
    prisma.vente.findMany({
      where: { statut: "VALIDEE", creeLe: dansPeriode },
      select: {
        creeLe: true,
        total: true,
        remise: true,
        caissier: { select: { nom: true } },
        client: { select: { nom: true } },
        paiements: { select: { mode: true, montant: true } },
        lignes: {
          select: {
            quantite: true,
            prixUnitaire: true,
            produit: { select: { nom: true, categorie: { select: { nom: true } } } },
            lots: { select: { quantite: true, lot: { select: { prixAchat: true } } } },
          },
        },
      },
    }),
    prisma.achat.findMany({
      where: { statut: { not: "ANNULE" }, creeLe: dansPeriode },
      select: { creeLe: true, total: true },
    }),
    prisma.mouvementStock.findMany({
      where: { type: { in: ["PERTE", "INVENTAIRE"] }, creeLe: dansPeriode },
      select: { type: true, quantite: true, lot: { select: { prixAchat: true } } },
    }),
    prisma.production.findMany({
      where: { statut: "VALIDEE", creeLe: dansPeriode },
      select: { coutTotal: true },
    }),
  ]);

  const serie = creerSerie(p);
  const produits = new Map<string, Classement>();
  const categories = new Map<string, Classement>();
  const caissiers = new Map<string, { nom: string; nb: number; ca: number }>();
  const clients = new Map<string, { nom: string; nb: number; ca: number }>();
  const modes = new Map<string, number>();

  let ca = 0, remises = 0, cmv = 0, encaisse = 0, credits = 0;

  for (const v of ventes) {
    let cmvVente = 0;
    for (const l of v.lignes) {
      const caLigne = l.quantite.mul(l.prixUnitaire).round().toNumber();
      const cmvLigne = Math.round(
        l.lots.reduce((s, x) => s + x.quantite.mul(x.lot.prixAchat).toNumber(), 0),
      );
      cmvVente += cmvLigne;

      const pr = produits.get(l.produit.nom) ?? { nom: l.produit.nom, ca: 0, marge: 0, quantite: 0 };
      pr.ca += caLigne; pr.marge += caLigne - cmvLigne; pr.quantite += l.quantite.toNumber();
      produits.set(l.produit.nom, pr);

      const nomCat = l.produit.categorie.nom;
      const ct = categories.get(nomCat) ?? { nom: nomCat, ca: 0, marge: 0, quantite: 0 };
      ct.ca += caLigne; ct.marge += caLigne - cmvLigne; ct.quantite += l.quantite.toNumber();
      categories.set(nomCat, ct);
    }

    ca += v.total; remises += v.remise; cmv += cmvVente;
    const pt = serie[indexDans(p, v.creeLe)];
    if (pt) { pt.ca += v.total; pt.marge += v.total - cmvVente; }

    const cs = caissiers.get(v.caissier.nom) ?? { nom: v.caissier.nom, nb: 0, ca: 0 };
    cs.nb += 1; cs.ca += v.total; caissiers.set(v.caissier.nom, cs);
    if (v.client) {
      const cl = clients.get(v.client.nom) ?? { nom: v.client.nom, nb: 0, ca: 0 };
      cl.nb += 1; cl.ca += v.total; clients.set(v.client.nom, cl);
    }
    for (const pa of v.paiements) {
      modes.set(pa.mode, (modes.get(pa.mode) ?? 0) + pa.montant);
      if (pa.mode === "CREDIT") credits += pa.montant; else encaisse += pa.montant;
    }
  }

  let totalAchats = 0;
  for (const a of achats) {
    totalAchats += a.total;
    const pt = serie[indexDans(p, a.creeLe)];
    if (pt) pt.achats += a.total;
  }

  let pertes = 0, ecartInventaire = 0;
  for (const m of mouvements) {
    const valeur = Math.round(m.quantite.mul(m.lot.prixAchat).toNumber());
    if (m.type === "PERTE") pertes += Math.abs(valeur);
    else ecartInventaire += valeur; // signé : négatif = manquant
  }

  const marge = ca - cmv;
  const resume: Resume = {
    nbVentes: ventes.length,
    ca, remises, cmv, marge,
    tauxMarge: ca > 0 ? Math.round((marge / ca) * 1000) / 10 : 0,
    panierMoyen: ventes.length ? Math.round(ca / ventes.length) : 0,
    encaisse, credits,
    achats: totalAchats,
    nbAchats: achats.length,
    pertes, ecartInventaire,
    nbProductions: productions.length,
    coutProduction: productions.reduce((s, x) => s + x.coutTotal, 0),
    resultat: marge - pertes + ecartInventaire,
  };

  const parCa = <T extends { ca: number }>(m: Map<string, T>, n: number) =>
    [...m.values()].sort((a, b) => b.ca - a.ca).slice(0, n);

  return {
    resume,
    serie,
    topProduits: parCa(produits, 8),
    categories: parCa(categories, 8),
    caissiers: parCa(caissiers, 8),
    clients: parCa(clients, 8),
    modes: [...modes.entries()].map(([mode, montant]) => ({ mode, montant })),
  };
}

/** Situation à l'instant présent (indépendante de la période choisie). */
export async function situationActuelle() {
  const [lots, creances] = await Promise.all([
    prisma.lot.findMany({
      where: { quantiteRestante: { gt: 0 } },
      select: { quantiteRestante: true, prixAchat: true },
    }),
    prisma.client.aggregate({ _sum: { solde: true } }),
  ]);
  return {
    valeurStock: Math.round(
      lots.reduce((s, l) => s + l.quantiteRestante.mul(l.prixAchat).toNumber(), 0),
    ),
    creancesClients: creances._sum.solde ?? 0,
  };
}

// ───────────────────────── Compatibilité tableau de bord / exports ─────────────────────────

/** Série du chiffre d'affaires sur les N derniers jours (graphique du tableau de bord). */
export async function statistiquesVentes(jours: number) {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (jours - 1));

  const ventes = await prisma.vente.findMany({
    where: { statut: "VALIDEE", creeLe: { gte: debut } },
    select: { creeLe: true, total: true },
  });
  const cle = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const parJour = new Map<string, { jour: string; ca: number; nb: number }>();
  for (let i = 0; i < jours; i++) {
    const d = new Date(debut);
    d.setDate(d.getDate() + i);
    parJour.set(cle(d), { jour: cle(d), ca: 0, nb: 0 });
  }
  for (const v of ventes) {
    const e = parJour.get(cle(v.creeLe));
    if (e) { e.ca += v.total; e.nb += 1; }
  }
  return { parJour: [...parJour.values()] };
}

export async function ventesPourExport(debut: Date, fin: Date) {
  return prisma.vente.findMany({
    where: { creeLe: { gte: debut, lt: fin } },
    orderBy: { creeLe: "asc" },
    include: { client: true, caissier: { select: { nom: true } }, paiements: true },
  });
}

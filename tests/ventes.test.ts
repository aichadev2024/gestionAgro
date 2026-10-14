import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { annulerVente, creerVente } from "@/server/services/ventes";
import { base, dans, lot, produit, restant } from "./helpers";

const vente = (c: Awaited<ReturnType<typeof base>>, produitId: string, quantite: string, extra = {}) =>
  creerVente(c.users.CAISSIER, {
    lignes: [{ produitId, quantite }],
    paiements: [{ mode: "ESPECES", montant: Math.round(Number(quantite) * 500) }],
    remise: 0,
    ...extra,
  });

describe("Ventes", () => {
  it("sort les lots en FEFO : la péremption la plus proche d'abord, même créée après", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const tard = await lot(c, p.id, "TARD", 50, { peremption: dans(300) });
    const tot = await lot(c, p.id, "TOT", 20, { peremption: dans(100) });

    await vente(c, p.id, "30");

    expect(await restant(tot.id)).toBe(0);
    expect(await restant(tard.id)).toBe(40);
  });

  it("ne vend jamais un lot périmé et ne rend jamais le stock négatif", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const perime = await lot(c, p.id, "OLD", 99, { peremption: dans(-10) });
    const bon = await lot(c, p.id, "OK", 10, { peremption: dans(60) });

    await expect(vente(c, p.id, "11")).rejects.toThrow(/Stock insuffisant/);
    expect(await restant(perime.id)).toBe(99);
    expect(await restant(bon.id)).toBe(10);
  });

  it("trace la sortie dans LigneVenteLot et crée un mouvement négatif", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 20);
    const v = await vente(c, p.id, "5");

    const sorties = await prisma.ligneVenteLot.findMany({ where: { lotId: l.id } });
    expect(sorties).toHaveLength(1);
    expect(sorties[0].quantite.toNumber()).toBe(5);
    const mvt = await prisma.mouvementStock.findFirstOrThrow({ where: { lotId: l.id, type: "VENTE" } });
    expect(mvt.quantite.toNumber()).toBe(-5);
    expect(mvt.reference).toBe(v.numero);
  });

  it("numérote les factures dans l'ordre", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100);
    const a = await vente(c, p.id, "1");
    const b = await vente(c, p.id, "1");
    const annee = new Date().getFullYear();
    expect(a.numero).toBe(`FAC-${annee}-000001`);
    expect(b.numero).toBe(`FAC-${annee}-000002`);
  });

  it("exige que les paiements égalent le total", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 10);
    await expect(
      creerVente(c.users.CAISSIER, {
        lignes: [{ produitId: p.id, quantite: "2" }],
        paiements: [{ mode: "ESPECES", montant: 500 }],
        remise: 0,
      }),
    ).rejects.toThrow(/doivent égaler le total/);
  });

  it("refuse une vente à crédit sans client, ou au-delà du plafond", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100);
    const client = await prisma.client.create({ data: { nom: "Moussa", plafondCredit: 10000 } });

    await expect(
      creerVente(c.users.CAISSIER, {
        lignes: [{ produitId: p.id, quantite: "2" }],
        paiements: [{ mode: "CREDIT", montant: 1000 }],
        remise: 0,
      }),
    ).rejects.toThrow(/client est requis/);

    await expect(
      creerVente(c.users.CAISSIER, {
        clientId: client.id,
        lignes: [{ produitId: p.id, quantite: "30" }],
        paiements: [{ mode: "CREDIT", montant: 15000 }],
        remise: 0,
      }),
    ).rejects.toThrow(/Plafond de crédit dépassé/);
  });

  it("enregistre un paiement mixte et augmente la dette du client du seul montant à crédit", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100);
    const client = await prisma.client.create({ data: { nom: "Awa", plafondCredit: 10000 } });

    await creerVente(c.users.CAISSIER, {
      clientId: client.id,
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [
        { mode: "CREDIT", montant: 3000 },
        { mode: "ORANGE_MONEY", montant: 2000 },
      ],
      remise: 0,
    });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).solde).toBe(3000);
  });

  it("annule une vente : stock et dette du client sont rétablis, une seule fois", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 100);
    const client = await prisma.client.create({ data: { nom: "Awa", plafondCredit: 10000 } });
    const v = await creerVente(c.users.CAISSIER, {
      clientId: client.id,
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "CREDIT", montant: 5000 }],
      remise: 0,
    });
    expect(await restant(l.id)).toBe(90);

    await annulerVente(c.users.GERANT, v.id, "erreur de saisie");
    expect(await restant(l.id)).toBe(100);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).solde).toBe(0);
    const apres = await prisma.vente.findUniqueOrThrow({ where: { id: v.id } });
    expect(apres.statut).toBe("ANNULEE");
    expect(apres.motifAnnulation).toBe("erreur de saisie");
    expect(apres.annuleeParId).toBe(c.users.GERANT);

    await expect(annulerVente(c.users.GERANT, v.id, "encore")).rejects.toThrow(/déjà annulée/);
    await expect(annulerVente(c.users.GERANT, v.id, " ")).rejects.toThrow();
  });

  it("vend uniquement depuis le dépôt choisi", async () => {
    const c = await base();
    const depotB = await prisma.depot.create({ data: { nom: "Dépôt B" } });
    const p = await produit(c, "P1");
    await lot(c, p.id, "A", 10);
    const lotB = await lot(c, p.id, "B", 10, { depotId: depotB.id });

    await expect(vente(c, p.id, "15", { depotId: depotB.id })).rejects.toThrow(/Stock insuffisant/);
    await vente(c, p.id, "4", { depotId: depotB.id });
    expect(await restant(lotB.id)).toBe(6);
  });

  it("applique une remise sans jamais dépasser le total", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 20);
    const v = await creerVente(c.users.GERANT, {
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "ESPECES", montant: 4000 }],
      remise: 1000,
    });
    expect(v.total).toBe(4000);
    await expect(
      creerVente(c.users.GERANT, {
        lignes: [{ produitId: p.id, quantite: "1" }],
        paiements: [{ mode: "ESPECES", montant: 0 }],
        remise: 9999,
      }),
    ).rejects.toThrow(/remise dépasse/);
  });
});

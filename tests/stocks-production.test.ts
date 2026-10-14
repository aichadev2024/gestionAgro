import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { annulerProduction, creerRecette, produire } from "@/server/services/production";
import { declarerPerte, etatStock, inventorierLot, transfererLot } from "@/server/services/stocks";
import { base, dans, lot, produit, restant } from "./helpers";

describe("Stocks", () => {
  it("déclare une perte avec motif obligatoire et sans dépasser le stock", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 50);

    await declarerPerte(c.users.MAGASINIER, l.id, "5", "casse");
    expect(await restant(l.id)).toBe(45);
    expect((await prisma.mouvementStock.findFirstOrThrow({ where: { type: "PERTE" } })).quantite.toNumber()).toBe(-5);
    expect(await prisma.journalAction.count({ where: { action: "PERTE_STOCK" } })).toBe(1);

    await expect(declarerPerte(c.users.MAGASINIER, l.id, "999", "x")).rejects.toThrow(/Il ne reste que 45/);
    await expect(declarerPerte(c.users.MAGASINIER, l.id, "1", " ")).rejects.toThrow(/motif/);
    expect(await restant(l.id)).toBe(45);
  });

  it("aligne le stock sur l'inventaire et trace l'écart", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 45);

    await inventorierLot(c.users.GERANT, l.id, "42", "erreur de saisie");
    expect(await restant(l.id)).toBe(42);
    expect((await prisma.mouvementStock.findFirstOrThrow({ where: { type: "INVENTAIRE" } })).quantite.toNumber()).toBe(-3);
    await expect(inventorierLot(c.users.GERANT, l.id, "42", "x")).rejects.toThrow(/Aucun écart/);
  });

  it("transfère vers un autre dépôt en regroupant les transferts dans un seul lot", async () => {
    const c = await base();
    const depotB = await prisma.depot.create({ data: { nom: "Dépôt B" } });
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 42, { peremption: dans(90) });

    await transfererLot(c.users.MAGASINIER, l.id, depotB.id, "12");
    await transfererLot(c.users.MAGASINIER, l.id, depotB.id, "8");

    expect(await restant(l.id)).toBe(22);
    const chezB = await prisma.lot.findMany({ where: { depotId: depotB.id } });
    expect(chezB).toHaveLength(1);
    expect(chezB[0].quantiteRestante.toNumber()).toBe(20);

    await expect(transfererLot(c.users.MAGASINIER, l.id, c.depot.id, "1")).rejects.toThrow(/différent/);
    await expect(transfererLot(c.users.MAGASINIER, l.id, depotB.id, "999")).rejects.toThrow(/Il ne reste que/);
    // Le stock total est conservé : 22 + 20 = 42
  });

  it("signale stock bas, péremptions proches et lots périmés", async () => {
    const c = await base();
    const bas = await produit(c, "BAS", { seuilAlerte: 30 });
    const ok = await produit(c, "OK", { seuilAlerte: 10 });
    await lot(c, bas.id, "B1", 20, { peremption: dans(10) });
    await lot(c, ok.id, "O1", 100, { peremption: dans(200) });
    await lot(c, ok.id, "O2", 5, { peremption: dans(-3) });

    const etat = await etatStock();
    expect(etat.parProduit.find((x) => x.produit.id === bas.id)?.stockBas).toBe(true);
    expect(etat.parProduit.find((x) => x.produit.id === ok.id)?.stockBas).toBe(false);
    expect(etat.bientot).toHaveLength(1);
    expect(etat.perimes).toHaveLength(1);
  });
});

describe("Production", () => {
  async function jeu() {
    const c = await base();
    const mil = await produit(c, "MIL");
    const sucre = await produit(c, "SUC");
    const farine = await produit(c, "FAR", { perissable: true });
    const m1 = await lot(c, mil.id, "M1", 10, { peremption: dans(400), prixAchat: 200 });
    const m2 = await lot(c, mil.id, "M2", 30, { peremption: dans(100), prixAchat: 300 });
    const s1 = await lot(c, sucre.id, "S1", 20, { prixAchat: 500 });
    const recette = await creerRecette("Farine", farine.id, "10", [
      { produitId: mil.id, quantite: "8" },
      { produitId: sucre.id, quantite: "2" },
    ]);
    return { c, mil, sucre, farine, m1, m2, s1, recette };
  }

  it("consomme les matières en FEFO, calcule le coût de revient et le rendement", async () => {
    const { c, m1, m2, s1, recette } = await jeu();
    const prod = await produire(c.users.RESPONSABLE_PRODUCTION, recette.id, "2", "18", "PF1", dans(365));

    // 2 lots de recette = 16 de mil (pris sur M2 qui périme avant) + 4 de sucre
    expect(await restant(m2.id)).toBe(14);
    expect(await restant(m1.id)).toBe(10);
    expect(await restant(s1.id)).toBe(16);
    // coût = 16×300 + 4×500 = 6800 ; obtenu 18 → 378 par unité
    expect(prod.coutTotal).toBe(6800);
    expect(prod.quantiteTheorique.toNumber()).toBe(20);
    const fini = await prisma.lot.findUniqueOrThrow({ where: { id: prod.lotId } });
    expect(fini.quantiteRestante.toNumber()).toBe(18);
    expect(fini.prixAchat).toBe(378);
    expect(await prisma.consommationProduction.count({ where: { productionId: prod.id } })).toBe(2);
  });

  it("refuse sans péremption (produit périssable) ou sans matières suffisantes", async () => {
    const { c, recette, m1, m2 } = await jeu();
    await expect(produire(c.users.RESPONSABLE_PRODUCTION, recette.id, "1", "10", "PF1")).rejects.toThrow(
      /péremption requise/,
    );
    await expect(
      produire(c.users.RESPONSABLE_PRODUCTION, recette.id, "6", "60", "PF1", dans(365)),
    ).rejects.toThrow(/Stock insuffisant/);
    // tout est annulé : les matières sont intactes
    expect(await restant(m1.id)).toBe(10);
    expect(await restant(m2.id)).toBe(30);
  });

  it("rejette une recette dont le produit fini est sa propre matière", async () => {
    const { farine } = await jeu();
    await expect(creerRecette("Boucle", farine.id, "1", [{ produitId: farine.id, quantite: "1" }])).rejects.toThrow(
      /propre matière/,
    );
  });

  it("annule une production : matières rendues, produit fini retiré, une seule fois", async () => {
    const { c, m1, m2, s1, recette } = await jeu();
    const prod = await produire(c.users.RESPONSABLE_PRODUCTION, recette.id, "2", "18", "PF1", dans(365));

    await annulerProduction(c.users.GERANT, prod.id, "erreur");
    expect(await restant(m1.id)).toBe(10);
    expect(await restant(m2.id)).toBe(30);
    expect(await restant(s1.id)).toBe(20);
    expect(await restant(prod.lotId)).toBe(0);
    await expect(annulerProduction(c.users.GERANT, prod.id, "encore")).rejects.toThrow(/déjà annulée/);
  });

  it("refuse l'annulation si le produit fini a déjà été utilisé", async () => {
    const { c, recette } = await jeu();
    const prod = await produire(c.users.RESPONSABLE_PRODUCTION, recette.id, "1", "10", "PF1", dans(365));
    await declarerPerte(c.users.MAGASINIER, prod.lotId, "1", "casse");
    await expect(annulerProduction(c.users.GERANT, prod.id, "trop tard")).rejects.toThrow(
      /vendu ou déplacé/,
    );
  });
});

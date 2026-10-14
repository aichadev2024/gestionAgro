import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  annulerAchat,
  creerBonDeCommande,
  dettesFournisseurs,
  payerAchat,
  receptionner,
  resteAPayer,
} from "@/server/services/achats";
import { base, dans, produit } from "./helpers";

async function commande(c: Awaited<ReturnType<typeof base>>, perissable = false, quantite = "100") {
  const p = await produit(c, "P1", { perissable });
  const f = await prisma.fournisseur.create({ data: { nom: "Fournisseur" } });
  const achat = await creerBonDeCommande(c.users.GERANT, f.id, [
    { produitId: p.id, quantite, prixUnitaire: 400 },
  ]);
  const ligne = await prisma.ligneAchat.findFirstOrThrow({ where: { achatId: achat.id } });
  return { p, achat, ligne };
}

describe("Achats", () => {
  it("calcule le total et numérote le bon de commande", async () => {
    const c = await base();
    const { achat } = await commande(c);
    expect(achat.total).toBe(40000);
    expect(achat.numero).toBe(`BC-${new Date().getFullYear()}-000001`);
    expect(achat.statut).toBe("COMMANDE");
  });

  it("réceptionne en deux fois : un lot et un mouvement par réception, statut mis à jour", async () => {
    const c = await base();
    const { achat, ligne, p } = await commande(c);

    await receptionner(c.users.MAGASINIER, achat.id, [{ ligneId: ligne.id, quantite: "60", numeroLot: "L1" }]);
    expect((await prisma.achat.findUniqueOrThrow({ where: { id: achat.id } })).statut).toBe("RECU_PARTIEL");

    await receptionner(c.users.MAGASINIER, achat.id, [{ ligneId: ligne.id, quantite: "40", numeroLot: "L2" }]);
    expect((await prisma.achat.findUniqueOrThrow({ where: { id: achat.id } })).statut).toBe("RECU");

    const lots = await prisma.lot.findMany({ where: { produitId: p.id }, orderBy: { numeroLot: "asc" } });
    expect(lots.map((l) => l.quantiteRestante.toNumber())).toEqual([60, 40]);
    expect(lots[0].prixAchat).toBe(400);
    expect(await prisma.mouvementStock.count({ where: { type: "RECEPTION" } })).toBe(2);
  });

  it("refuse de recevoir plus que commandé, ou un produit périssable sans péremption", async () => {
    const c = await base();
    const { achat, ligne } = await commande(c, true);
    await expect(
      receptionner(c.users.MAGASINIER, achat.id, [
        { ligneId: ligne.id, quantite: "150", numeroLot: "L1", datePeremption: dans(90) },
      ]),
    ).rejects.toThrow(/reste à recevoir/);
    await expect(
      receptionner(c.users.MAGASINIER, achat.id, [{ ligneId: ligne.id, quantite: "10", numeroLot: "L1" }]),
    ).rejects.toThrow(/péremption requise/);
    expect(await prisma.lot.count()).toBe(0); // rien n'a été créé
  });

  it("reçoit dans le dépôt choisi", async () => {
    const c = await base();
    const depotB = await prisma.depot.create({ data: { nom: "Dépôt B" } });
    const { achat, ligne } = await commande(c);
    await receptionner(
      c.users.MAGASINIER,
      achat.id,
      [{ ligneId: ligne.id, quantite: "10", numeroLot: "L1" }],
      depotB.id,
    );
    expect((await prisma.lot.findFirstOrThrow()).depotId).toBe(depotB.id);
  });

  it("n'annule qu'une commande sans réception, avec motif, auteur et journal", async () => {
    const c = await base();
    const { achat, ligne } = await commande(c);
    await expect(annulerAchat(c.users.GERANT, achat.id, " ")).rejects.toThrow(/motif/);

    await annulerAchat(c.users.GERANT, achat.id, "doublon");
    const a = await prisma.achat.findUniqueOrThrow({ where: { id: achat.id } });
    expect(a.statut).toBe("ANNULE");
    expect(a.annuleParId).toBe(c.users.GERANT);
    expect(await prisma.journalAction.count({ where: { action: "ANNULATION_ACHAT" } })).toBe(1);
    await expect(
      receptionner(c.users.MAGASINIER, achat.id, [{ ligneId: ligne.id, quantite: "1", numeroLot: "L" }]),
    ).rejects.toThrow(/plus être réceptionnée/);
  });

  it("refuse l'annulation après une réception", async () => {
    const c = await base();
    const { achat, ligne } = await commande(c);
    await receptionner(c.users.MAGASINIER, achat.id, [{ ligneId: ligne.id, quantite: "5", numeroLot: "L1" }]);
    await expect(annulerAchat(c.users.GERANT, achat.id, "tard")).rejects.toThrow(/sans réception/);
  });

  it("suit les paiements au fournisseur et les dettes", async () => {
    const c = await base();
    const { achat } = await commande(c);
    expect(await dettesFournisseurs()).toBe(40000);

    await payerAchat(c.users.GERANT, achat.id, 15000, "ESPECES");
    await payerAchat(c.users.GERANT, achat.id, 5000, "ORANGE_MONEY");
    const apres = await prisma.achat.findUniqueOrThrow({
      where: { id: achat.id },
      include: { paiements: true },
    });
    expect(resteAPayer(apres)).toBe(20000);
    expect(await dettesFournisseurs()).toBe(20000);

    await expect(payerAchat(c.users.GERANT, achat.id, 20001, "ESPECES")).rejects.toThrow(/Il ne reste que 20000/);
    await expect(payerAchat(c.users.GERANT, achat.id, 0, "ESPECES")).rejects.toThrow(/entier positif/);
    await payerAchat(c.users.GERANT, achat.id, 20000, "ESPECES");
    expect(await dettesFournisseurs()).toBe(0);
  });

  it("ne compte pas une commande annulée dans les dettes", async () => {
    const c = await base();
    const { achat } = await commande(c);
    await annulerAchat(c.users.GERANT, achat.id, "erreur");
    expect(await dettesFournisseurs()).toBe(0);
    await expect(payerAchat(c.users.GERANT, achat.id, 100, "ESPECES")).rejects.toThrow(/annulée/);
  });
});

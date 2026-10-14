import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cloturerCaisse, especesAttendues } from "@/server/services/clotures";
import { encaisserCreance } from "@/server/services/clients";
import { annulerDepense, creerDepense } from "@/server/services/depenses";
import { creerRetour, quantitesRetournables } from "@/server/services/retours";
import { periodePrecedente, statistiquesPeriode, situationActuelle } from "@/server/services/statistiques";
import { annulerVente, creerVente } from "@/server/services/ventes";
import { base, lot, produit, restant } from "./helpers";

async function venteCredit(c: Awaited<ReturnType<typeof base>>) {
  const p = await produit(c, "P1");
  const l = await lot(c, p.id, "L1", 100, { prixAchat: 300 });
  const client = await prisma.client.create({ data: { nom: "Awa", plafondCredit: 50000 } });
  const v = await creerVente(c.users.CAISSIER, {
    clientId: client.id,
    lignes: [{ produitId: p.id, quantite: "10" }],
    paiements: [{ mode: "CREDIT", montant: 5000 }],
    remise: 0,
  });
  return { p, l, client, v };
}

describe("Créances clients", () => {
  it("encaisse un remboursement partiel puis total, jamais plus que la dette", async () => {
    const c = await base();
    const { client } = await venteCredit(c);

    await encaisserCreance(c.users.CAISSIER, client.id, 2000, "ESPECES");
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).solde).toBe(3000);

    await expect(encaisserCreance(c.users.CAISSIER, client.id, 3001, "ESPECES")).rejects.toThrow(/ne doit que 3000/);
    await expect(encaisserCreance(c.users.CAISSIER, client.id, 0, "ESPECES")).rejects.toThrow(/entier positif/);
    await expect(encaisserCreance(c.users.CAISSIER, client.id, 10.5, "ESPECES")).rejects.toThrow();

    await encaisserCreance(c.users.CAISSIER, client.id, 3000, "ORANGE_MONEY");
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).solde).toBe(0);
    expect(await prisma.encaissementClient.count()).toBe(2);
  });
});

describe("Retours clients", () => {
  it("rembourse et remet le produit en stock dans son lot d'origine", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 50, { prixAchat: 300 });
    const v = await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "ESPECES", montant: 5000 }],
      remise: 0,
    });
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });
    expect(await restant(l.id)).toBe(40);

    const r = await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "4" }], "ESPECES", "abîmé", true);
    expect(r.total).toBe(2000);
    expect(await restant(l.id)).toBe(44);
    expect((await quantitesRetournables(v.id)).get(ligne.id)?.toNumber()).toBe(6);
    expect(await prisma.mouvementStock.count({ where: { type: "RETOUR_CLIENT" } })).toBe(1);
  });

  it("refuse de retourner plus que vendu, et la vente ne peut plus être annulée ensuite", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 50);
    const v = await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "ESPECES", montant: 5000 }],
      remise: 0,
    });
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });

    await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "6" }], "ESPECES", "x", true);
    await expect(
      creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "5" }], "ESPECES", "x", true),
    ).rejects.toThrow(/encore retournable/);
    await expect(annulerVente(c.users.GERANT, v.id, "tard")).rejects.toThrow(/des retours existent/);
    await expect(creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "1" }], "ESPECES", " ", true)).rejects.toThrow(/motif/);
  });

  it("répartit une remise au prorata dans le remboursement", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 50);
    // 10 × 500 = 5000, remise 1000 → payé 4000 (facteur 0,8)
    const v = await creerVente(c.users.GERANT, {
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "ESPECES", montant: 4000 }],
      remise: 1000,
    });
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });
    const r = await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "5" }], "ESPECES", "x", true);
    expect(r.total).toBe(2000); // 5 × 500 × 0,8
  });

  it("peut réduire la dette du client, sans dépasser ce qu'il doit", async () => {
    const c = await base();
    const { v, client } = await venteCredit(c);
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });

    await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "4" }], "CREDIT", "x", true);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).solde).toBe(3000);

    await encaisserCreance(c.users.CAISSIER, client.id, 2500, "ESPECES"); // dette = 500
    await expect(
      creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "3" }], "CREDIT", "x", true),
    ).rejects.toThrow(/ne doit que 500/);
  });

  it("sans remise en stock, le lot n'est pas réapprovisionné", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    const l = await lot(c, p.id, "L1", 50);
    const v = await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "10" }],
      paiements: [{ mode: "ESPECES", montant: 5000 }],
      remise: 0,
    });
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });
    await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "2" }], "ESPECES", "périmé", false);
    expect(await restant(l.id)).toBe(40);
  });
});

describe("Dépenses", () => {
  it("enregistre, refuse les montants invalides et annule avec motif", async () => {
    const c = await base();
    const d = await creerDepense(c.users.GERANT, {
      categorie: "Loyer",
      libelle: "Loyer octobre",
      montant: 75000,
      mode: "ESPECES",
      dateDepense: new Date().toISOString().slice(0, 10),
    });
    await expect(
      creerDepense(c.users.GERANT, { categorie: "Loyer", libelle: "x", montant: -5, mode: "ESPECES", dateDepense: "2026-01-01" }),
    ).rejects.toThrow(/entier positif/);
    await expect(
      creerDepense(c.users.GERANT, { categorie: "Loyer", libelle: "x", montant: 5, mode: "ESPECES", dateDepense: "2999-01-01" }),
    ).rejects.toThrow(/futur/);

    await expect(annulerDepense(c.users.GERANT, d.id, " ")).rejects.toThrow(/motif/);
    await annulerDepense(c.users.GERANT, d.id, "erreur");
    await expect(annulerDepense(c.users.GERANT, d.id, "encore")).rejects.toThrow(/déjà annulée/);
    expect((await prisma.depense.findUniqueOrThrow({ where: { id: d.id } })).annuleParId).toBe(c.users.GERANT);
  });
});

describe("Clôture de caisse", () => {
  it("calcule les espèces attendues et l'écart, une seule clôture par jour", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100);
    const client = await prisma.client.create({ data: { nom: "Awa", plafondCredit: 50000 } });

    // +5000 espèces, +2000 mobile (hors tiroir), +3000 crédit (hors tiroir)
    await creerVente(c.users.CAISSIER, {
      clientId: client.id,
      lignes: [{ produitId: p.id, quantite: "20" }],
      paiements: [
        { mode: "ESPECES", montant: 5000 },
        { mode: "ORANGE_MONEY", montant: 2000 },
        { mode: "CREDIT", montant: 3000 },
      ],
      remise: 0,
    });
    await encaisserCreance(c.users.CAISSIER, client.id, 1000, "ESPECES"); // +1000
    await creerDepense(c.users.CAISSIER as string, {
      categorie: "Transport",
      libelle: "Taxi",
      montant: 500,
      mode: "ESPECES",
      dateDepense: new Date().toISOString().slice(0, 10),
    }); // −500

    const calcul = await especesAttendues(c.users.CAISSIER);
    expect(calcul.attendu).toBe(5000 + 1000 - 500);
    expect(calcul.mobileMoney).toBe(2000);

    const cloture = await cloturerCaisse(c.users.CAISSIER, 5400, "billet déchiré");
    expect(cloture.attendu).toBe(5500);
    expect(cloture.ecart).toBe(-100);
    await expect(cloturerCaisse(c.users.CAISSIER, 5500)).rejects.toThrow(/déjà clôturée/);
  });
});

describe("Statistiques", () => {
  it("calcule CA, marge, retours, pertes et dépenses cohérents, et le gain net", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100, { prixAchat: 300 });
    const maintenant = new Date();
    const periode = { vue: "mois" as const, annee: maintenant.getFullYear(), mois: maintenant.getMonth() + 1 };

    const v = await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "20" }],
      paiements: [{ mode: "ESPECES", montant: 9000 }],
      remise: 1000,
    }); // CA 9000, coût 6000, marge 3000
    const ligne = await prisma.ligneVente.findFirstOrThrow({ where: { venteId: v.id } });
    await creerRetour(c.users.GERANT, v.id, [{ ligneVenteId: ligne.id, quantite: "10" }], "ESPECES", "x", true); // rembourse 4500, coût récupéré 3000
    await creerDepense(c.users.GERANT, {
      categorie: "Loyer", libelle: "Loyer", montant: 1000, mode: "ESPECES",
      dateDepense: maintenant.toISOString().slice(0, 10),
    });

    const s = await statistiquesPeriode(periode);
    expect(s.resume.nbVentes).toBe(1);
    expect(s.resume.retours).toBe(4500);
    expect(s.resume.ca).toBe(9000 - 4500);
    expect(s.resume.cmv).toBe(6000 - 3000);
    expect(s.resume.marge).toBe(4500 - 3000);
    expect(s.resume.depenses).toBe(1000);
    expect(s.resume.resultat).toBe(1500 - 1000);
    expect(s.categoriesDepenses).toEqual([{ nom: "Loyer", ca: 1000 }]);
    expect(s.serie.reduce((t, x) => t + x.ca, 0)).toBe(s.resume.ca);

    const avant = await statistiquesPeriode(periodePrecedente(periode));
    expect(avant.resume.ca).toBe(0);
  });

  it("indique la valeur du stock, les créances et les dettes fournisseurs", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 10, { prixAchat: 300 });
    await prisma.client.create({ data: { nom: "Awa", solde: 2500 } });
    const s = await situationActuelle();
    expect(s.valeurStock).toBe(3000);
    expect(s.creancesClients).toBe(2500);
    expect(s.dettesFournisseurs).toBe(0);
  });
});

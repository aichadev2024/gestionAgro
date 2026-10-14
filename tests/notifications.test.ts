import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { notificationsPour } from "@/server/services/notifications";
import { cloturerCaisse } from "@/server/services/clotures";
import { creerRecette } from "@/server/services/production";
import { declarerPerte } from "@/server/services/stocks";
import { creerVente } from "@/server/services/ventes";
import { base, dans, lot, produit } from "./helpers";

const ids = async (c: Awaited<ReturnType<typeof base>>, role: keyof typeof c.users) =>
  (await notificationsPour({ id: c.users[role], role: role as Role })).map((n) => n.id);

describe("Notifications", () => {
  it("n'affiche rien quand tout est en ordre", async () => {
    const c = await base();
    const p = await produit(c, "P1", { seuilAlerte: 5 });
    await lot(c, p.id, "L1", 100, { peremption: dans(300) });
    expect(await ids(c, "GERANT")).toEqual([]);
  });

  it("signale stock bas, péremptions proches et lots périmés, et ces alertes disparaissent une fois réglées", async () => {
    const c = await base();
    const bas = await produit(c, "BAS", { seuilAlerte: 30 });
    await lot(c, bas.id, "B1", 10, { peremption: dans(300) });
    const proche = await produit(c, "PRO");
    await lot(c, proche.id, "P1", 50, { peremption: dans(10) });
    const vieux = await produit(c, "VIE");
    const lotPerime = await lot(c, vieux.id, "V1", 5, { peremption: dans(-2) });

    const avant = await notificationsPour({ id: c.users.MAGASINIER, role: "MAGASINIER" });
    expect(avant.map((n) => n.id)).toEqual(
      expect.arrayContaining(["stock-bas", "peremption-proche", "lots-perimes"]),
    );
    expect(avant.find((n) => n.id === "lots-perimes")?.niveau).toBe("critique");
    expect(avant[0].niveau).toBe("critique"); // les urgences d'abord

    await declarerPerte(c.users.MAGASINIER, lotPerime.id, "5", "périmé");
    expect(await ids(c, "MAGASINIER")).not.toContain("lots-perimes");
  });

  it("signale les commandes non reçues depuis plus de 7 jours", async () => {
    const c = await base();
    const f = await prisma.fournisseur.create({ data: { nom: "Fournisseur" } });
    await prisma.achat.create({
      data: {
        numero: "BC-1", fournisseurId: f.id, statut: "COMMANDE", total: 1000,
        creeLe: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      },
    });
    expect(await ids(c, "MAGASINIER")).toContain("commandes-en-retard");
  });

  it("réserve créances, dettes et caisse aux administrateurs et gérants", async () => {
    const c = await base();
    await prisma.client.create({ data: { nom: "Awa", solde: 9000, plafondCredit: 10000 } });
    const f = await prisma.fournisseur.create({ data: { nom: "Fournisseur" } });
    await prisma.achat.create({
      data: {
        numero: "BC-1", fournisseurId: f.id, statut: "RECU", total: 5000,
        creeLe: new Date(Date.now() - 40 * 24 * 3600 * 1000),
      },
    });

    const gerant = await ids(c, "GERANT");
    expect(gerant).toEqual(expect.arrayContaining(["plafond-proche", "creances", "dettes-anciennes"]));
    expect(await ids(c, "MAGASINIER")).not.toContain("creances");
    expect(await ids(c, "CAISSIER")).not.toContain("dettes-anciennes");
    expect(await ids(c, "RESPONSABLE_PRODUCTION")).not.toContain("plafond-proche");
  });

  it("signale une caisse d'un jour passé non clôturée et un écart de caisse", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100, { peremption: dans(300) });
    const v = await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "2" }],
      paiements: [{ mode: "ESPECES", montant: 1000 }],
      remise: 0,
    });
    // la vente date d'hier
    await prisma.vente.update({ where: { id: v.id }, data: { creeLe: new Date(Date.now() - 26 * 3600 * 1000) } });
    expect(await ids(c, "GERANT")).toContain("clotures-manquantes");

    await cloturerCaisse(c.users.CAISSIER, 500, "billet manquant"); // écart de −(attendu du jour = 0) → +500
    expect(await ids(c, "GERANT")).toContain("ecarts-caisse");
  });

  it("rappelle au caissier de clôturer sa caisse, seulement s'il a vendu aujourd'hui", async () => {
    const c = await base();
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 100, { peremption: dans(300) });
    expect(await ids(c, "CAISSIER")).not.toContain("ma-caisse");

    await creerVente(c.users.CAISSIER, {
      lignes: [{ produitId: p.id, quantite: "2" }],
      paiements: [{ mode: "ESPECES", montant: 1000 }],
      remise: 0,
    });
    expect(await ids(c, "CAISSIER")).toContain("ma-caisse");
    await cloturerCaisse(c.users.CAISSIER, 1000);
    expect(await ids(c, "CAISSIER")).not.toContain("ma-caisse");
  });

  it("signale à la production une recette impossible faute de matières", async () => {
    const c = await base();
    const mil = await produit(c, "MIL");
    const farine = await produit(c, "FAR");
    await lot(c, mil.id, "M1", 3);
    await creerRecette("Farine de mil", farine.id, "10", [{ produitId: mil.id, quantite: "8" }]);

    const n = await notificationsPour({ id: c.users.RESPONSABLE_PRODUCTION, role: "RESPONSABLE_PRODUCTION" });
    expect(n).toHaveLength(1);
    expect(n[0].titre).toContain("Farine de mil");

    await lot(c, mil.id, "M2", 10);
    expect(await ids(c, "RESPONSABLE_PRODUCTION")).toEqual([]);
  });
});

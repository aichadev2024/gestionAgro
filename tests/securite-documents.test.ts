import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { genererFacturePdf } from "@/lib/pdf-facture";
import { classeurExcel } from "@/lib/xlsx";
import { compteBloque, enregistrerEchec, enregistrerSucces, MAX_ECHECS } from "@/server/services/connexion";
import { importerProduits } from "@/server/services/import-produits";
import {
  basculerActif,
  changerMonMotDePasse,
  changerRole,
  creerUtilisateur,
  reinitialiserMotDePasse,
} from "@/server/services/utilisateurs";
import { base } from "./helpers";

describe("Blocage après essais répétés", () => {
  it("bloque après 5 échecs, insensible à la casse, et se réinitialise après un succès", async () => {
    for (let i = 0; i < MAX_ECHECS - 1; i++) await enregistrerEchec("Aicha@Test.local");
    expect(await compteBloque("aicha@test.local")).toBe(false);
    await enregistrerEchec("aicha@test.local");
    expect(await compteBloque("AICHA@test.local")).toBe(true);
    expect(await compteBloque("autre@test.local")).toBe(false);

    await enregistrerSucces("aicha@test.local");
    expect(await compteBloque("aicha@test.local")).toBe(false);
  });

  it("ignore les échecs plus vieux que la fenêtre de 15 minutes", async () => {
    await prisma.tentativeConnexion.createMany({
      data: Array.from({ length: 6 }, () => ({
        email: "vieux@test.local",
        reussie: false,
        creeLe: new Date(Date.now() - 30 * 60_000),
      })),
    });
    expect(await compteBloque("vieux@test.local")).toBe(false);
  });
});

describe("Utilisateurs", () => {
  it("hache les mots de passe, normalise l'email et refuse les mots de passe courts ou les doublons", async () => {
    const c = await base();
    await expect(
      creerUtilisateur(c.users.ADMIN, { nom: "X", email: "x@test.local", role: "CAISSIER", motDePasse: "abc" }),
    ).rejects.toThrow(/8 caractères/);

    await creerUtilisateur(c.users.ADMIN, { nom: "Fatou", email: "FATOU@Test.local", role: "CAISSIER", motDePasse: "motdepasse1" });
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "fatou@test.local" } });
    expect(u.motDePasse).not.toContain("motdepasse1");
    expect(await bcrypt.compare("motdepasse1", u.motDePasse)).toBe(true);

    await expect(
      creerUtilisateur(c.users.ADMIN, { nom: "Bis", email: "fatou@test.local", role: "CAISSIER", motDePasse: "motdepasse1" }),
    ).rejects.toThrow();
  });

  it("protège le dernier administrateur et l'auto-modification", async () => {
    const c = await base();
    await expect(changerRole(c.users.ADMIN, c.users.ADMIN, "CAISSIER")).rejects.toThrow(/propre rôle/);
    await expect(basculerActif(c.users.ADMIN, c.users.ADMIN)).rejects.toThrow(/propre compte/);

    // Avec un seul administrateur actif, personne ne peut le rétrograder ou le désactiver.
    await expect(changerRole(c.users.GERANT, c.users.ADMIN, "CAISSIER")).rejects.toThrow(/au moins un administrateur/);
    await expect(basculerActif(c.users.GERANT, c.users.ADMIN)).rejects.toThrow(/au moins un administrateur/);

    // Avec un second administrateur, on peut rétrograder l'un des deux.
    const autre = await prisma.user.create({
      data: { nom: "Admin 2", email: "a2@test.local", role: "ADMIN", motDePasse: "x" },
    });
    await changerRole(c.users.ADMIN, autre.id, "GERANT");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: autre.id } })).role).toBe("GERANT");
  });

  it("change son propre mot de passe seulement avec l'ancien", async () => {
    const c = await base();
    await prisma.user.update({ where: { id: c.users.CAISSIER }, data: { motDePasse: await bcrypt.hash("ancien-mdp-1", 10) } });

    await expect(changerMonMotDePasse(c.users.CAISSIER, "faux", "nouveau-mdp-1")).rejects.toThrow(/actuel est incorrect/);
    await expect(changerMonMotDePasse(c.users.CAISSIER, "ancien-mdp-1", "court")).rejects.toThrow(/8 caractères/);
    await expect(changerMonMotDePasse(c.users.CAISSIER, "ancien-mdp-1", "ancien-mdp-1")).rejects.toThrow(/différent/);

    await changerMonMotDePasse(c.users.CAISSIER, "ancien-mdp-1", "nouveau-mdp-1");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: c.users.CAISSIER } });
    expect(await bcrypt.compare("nouveau-mdp-1", u.motDePasse)).toBe(true);
    expect(await prisma.journalAction.count({ where: { action: "CHANGEMENT_MOT_DE_PASSE" } })).toBe(1);

    await reinitialiserMotDePasse(c.users.ADMIN, c.users.CAISSIER, "reinit-mdp-99");
    expect(await bcrypt.compare("reinit-mdp-99", (await prisma.user.findUniqueOrThrow({ where: { id: c.users.CAISSIER } })).motDePasse)).toBe(true);
  });
});

describe("Import de produits", () => {
  const csv = (...lignes: string[]) =>
    Buffer.from(
      ["code;nom;categorie;unite;prix_achat;prix_vente;seuil_alerte;perissable;code_barres", ...lignes].join("\n"),
    );

  it("importe tout, crée les catégories manquantes et reconnaît l'unité par son nom ou son symbole", async () => {
    const c = await base();
    const r = await importerProduits(
      c.users.GERANT,
      "produits.csv",
      csv("riz25;Riz 25 kg;Céréales;kg;12000;15000;50;non;6001", "huile5;Huile 5 L;Huiles;Kilogramme;6000;7500;20;oui;"),
    );
    expect(r).toEqual({ crees: 2, erreurs: [] });
    expect(await prisma.categorie.count()).toBe(2); // Céréales existait, Huiles créée
    const huile = await prisma.produit.findUniqueOrThrow({ where: { code: "HUILE5" } });
    expect(huile.perissable).toBe(true);
    expect((await prisma.produit.findUniqueOrThrow({ where: { code: "RIZ25" } })).codeBarres).toBe("6001");
    expect(await prisma.journalAction.count({ where: { action: "IMPORT_PRODUITS" } })).toBe(1);
  });

  it("est « tout ou rien » et indique les lignes en erreur", async () => {
    const c = await base();
    await prisma.produit.create({
      data: { code: "EXISTE", nom: "Existe", categorieId: c.categorie.id, uniteId: c.kg.id },
    });
    const r = await importerProduits(
      c.users.GERANT,
      "produits.csv",
      csv(
        "ok1;Bon produit;Céréales;kg;100;200;0;non;",
        "EXISTE;Doublon base;Céréales;kg;100;200;0;non;",
        "ok2;Unité inconnue;Céréales;tonne;100;200;0;non;",
        "ok1;Doublon fichier;Céréales;kg;100;200;0;non;",
        ";Sans code;Céréales;kg;100;200;0;non;",
        "ok3;Prix décimal;Céréales;kg;10.5;200;0;non;",
      ),
    );
    expect(r.crees).toBe(0);
    expect(r.erreurs.map((e) => e.ligne)).toEqual([3, 4, 5, 6, 7]);
    expect(await prisma.produit.count()).toBe(1); // rien d'importé, pas même la ligne valide
  });

  it("refuse un fichier sans les bonnes colonnes ou d'un format inconnu", async () => {
    const c = await base();
    await expect(importerProduits(c.users.GERANT, "x.csv", Buffer.from("a;b\n1;2"))).rejects.toThrow(/Colonnes manquantes/);
    await expect(importerProduits(c.users.GERANT, "x.pdf", Buffer.from("zzz"))).rejects.toThrow(/Format non supporté/);
  });

  it("lit aussi un vrai fichier Excel", async () => {
    const c = await base();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("P");
    ws.addRow(["code", "nom", "categorie", "unite", "prix_achat", "prix_vente", "seuil_alerte", "perissable", "code_barres"]);
    ws.addRow(["XLS1", "Produit Excel", "Épices", "kg", 500, 800, 5, "oui", ""]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    expect(await importerProduits(c.users.GERANT, "p.xlsx", buffer)).toEqual({ crees: 1, erreurs: [] });
  });
});

describe("Documents générés", () => {
  it("produit un PDF de facture valide, y compris avec beaucoup de lignes", async () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({
      produit: `Produit numéro ${i + 1} très long nom avec accents éèà`,
      quantite: "2.5",
      unite: "kg",
      prix: 1250,
      montant: 3125,
    }));
    const pdf = await genererFacturePdf({
      numero: "FAC-2026-000001",
      date: new Date(),
      statut: "VALIDEE",
      client: "Client Été",
      caissier: "Aïcha",
      remise: 500,
      total: 187000,
      lignes,
      paiements: [{ mode: "Espèces", montant: 187000 }],
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("produit un classeur Excel lisible et neutralise les formules", async () => {
    const buffer = await classeurExcel("Test", ["A", "B"], [["=SOMME(1;2)", 5], ["normal", 7]]);
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // un .xlsx est une archive zip
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getCell("A2").value).toBe("'=SOMME(1;2)");
    expect(ws.getCell("B3").value).toBe(7);
  });
});

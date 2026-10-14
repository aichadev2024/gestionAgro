import ExcelJS from "exceljs";
import { z } from "zod";
import { ErreurMetier } from "@/lib/erreurs";
import { prisma } from "@/lib/prisma";

export const COLONNES_MODELE = [
  "code",
  "nom",
  "categorie",
  "unite",
  "prix_achat",
  "prix_vente",
  "seuil_alerte",
  "perissable",
  "code_barres",
] as const;

export const MAX_LIGNES = 2000;
export const MAX_OCTETS = 2 * 1024 * 1024;

export type RapportImport = { crees: number; erreurs: { ligne: number; message: string }[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const ligneSchema = z.object({
  code: z.string().trim().min(1, "code manquant").max(30).transform((v) => v.toUpperCase()),
  nom: z.string().trim().min(1, "nom manquant").max(120),
  categorie: z.string().trim().min(1, "catégorie manquante").max(80),
  unite: z.string().trim().min(1, "unité manquante"),
  prixAchat: z.coerce.number().int("prix d'achat : entier requis").min(0),
  prixVente: z.coerce.number().int("prix de vente : entier requis").min(0),
  seuilAlerte: z.coerce.number().min(0),
  perissable: z.boolean(),
  codeBarres: z.string().trim().max(50).optional(),
});

function texte(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return String(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v);
}

/** Lit un fichier .xlsx ou .csv et renvoie les lignes sous forme d'objets (clé = nom de colonne normalisé). */
async function lireFichier(nom: string, contenu: Buffer): Promise<Record<string, string>[]> {
  let lignes: string[][] = [];
  if (nom.toLowerCase().endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(contenu as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new ErreurMetier("Le fichier ne contient aucune feuille.");
    ws.eachRow((row) => {
      const cellules: string[] = [];
      for (let i = 1; i <= COLONNES_MODELE.length + 2; i++) cellules.push(texte(row.getCell(i).value));
      lignes.push(cellules);
    });
  } else if (nom.toLowerCase().endsWith(".csv")) {
    const brut = contenu.toString("utf-8").replace(/^﻿/, "");
    const sep = brut.split("\n")[0].includes(";") ? ";" : ",";
    lignes = brut
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
  } else {
    throw new ErreurMetier("Format non supporté : utilisez un fichier .xlsx ou .csv.");
  }
  if (lignes.length === 0) throw new ErreurMetier("Le fichier est vide.");

  const entetes = lignes[0].map(norm);
  const manquantes = COLONNES_MODELE.filter((c) => !entetes.includes(c));
  if (manquantes.length > 0) {
    throw new ErreurMetier(`Colonnes manquantes : ${manquantes.join(", ")}. Téléchargez le modèle.`);
  }
  return lignes.slice(1).map((l) => {
    const o: Record<string, string> = {};
    entetes.forEach((e, i) => (o[e] = (l[i] ?? "").toString().trim()));
    return o;
  });
}

/** Import « tout ou rien » : si une ligne est invalide, rien n'est créé et toutes les erreurs sont listées. */
export async function importerProduits(
  auteurId: string,
  nomFichier: string,
  contenu: Buffer,
): Promise<RapportImport> {
  const lignes = await lireFichier(nomFichier, contenu);
  if (lignes.length > MAX_LIGNES) {
    throw new ErreurMetier(`Trop de lignes (${lignes.length}). Maximum : ${MAX_LIGNES} par import.`);
  }

  const unites = await prisma.unite.findMany();
  const existants = new Set((await prisma.produit.findMany({ select: { code: true } })).map((p) => p.code));
  const codesBarres = new Set(
    (await prisma.produit.findMany({ where: { codeBarres: { not: null } }, select: { codeBarres: true } })).map(
      (p) => p.codeBarres as string,
    ),
  );

  const erreurs: RapportImport["erreurs"] = [];
  const valides: { donnees: z.infer<typeof ligneSchema>; uniteId: string }[] = [];
  const vusDansFichier = new Set<string>();

  lignes.forEach((l, i) => {
    const numero = i + 2; // ligne 1 = en-têtes
    if (Object.values(l).every((v) => !v)) return; // ligne vide
    const parsed = ligneSchema.safeParse({
      code: l.code,
      nom: l.nom,
      categorie: l.categorie,
      unite: l.unite,
      prixAchat: l.prix_achat || 0,
      prixVente: l.prix_vente || 0,
      seuilAlerte: l.seuil_alerte || 0,
      perissable: ["oui", "o", "1", "true", "vrai", "yes"].includes(norm(l.perissable ?? "")),
      codeBarres: l.code_barres || undefined,
    });
    if (!parsed.success) {
      erreurs.push({ ligne: numero, message: parsed.error.issues[0]?.message ?? "ligne invalide" });
      return;
    }
    const d = parsed.data;
    const unite = unites.find((u) => norm(u.nom) === norm(d.unite) || norm(u.symbole) === norm(d.unite));
    if (!unite) {
      erreurs.push({ ligne: numero, message: `unité « ${d.unite} » inconnue (créez-la d'abord)` });
      return;
    }
    if (existants.has(d.code) || vusDansFichier.has(d.code)) {
      erreurs.push({ ligne: numero, message: `code ${d.code} déjà utilisé` });
      return;
    }
    if (d.codeBarres && (codesBarres.has(d.codeBarres) || vusDansFichier.has(`cb:${d.codeBarres}`))) {
      erreurs.push({ ligne: numero, message: `code-barres ${d.codeBarres} déjà utilisé` });
      return;
    }
    vusDansFichier.add(d.code);
    if (d.codeBarres) vusDansFichier.add(`cb:${d.codeBarres}`);
    valides.push({ donnees: d, uniteId: unite.id });
  });

  if (erreurs.length > 0 || valides.length === 0) {
    return { crees: 0, erreurs: erreurs.length ? erreurs : [{ ligne: 0, message: "Aucune ligne à importer." }] };
  }

  await prisma.$transaction(async (tx) => {
    const categories = new Map<string, string>();
    for (const c of await tx.categorie.findMany()) categories.set(norm(c.nom), c.id);

    for (const { donnees: d, uniteId } of valides) {
      let categorieId = categories.get(norm(d.categorie));
      if (!categorieId) {
        categorieId = (await tx.categorie.create({ data: { nom: d.categorie } })).id;
        categories.set(norm(d.categorie), categorieId);
      }
      await tx.produit.create({
        data: {
          code: d.code,
          nom: d.nom,
          categorieId,
          uniteId,
          prixAchat: d.prixAchat,
          prixVente: d.prixVente,
          seuilAlerte: d.seuilAlerte,
          perissable: d.perissable,
          codeBarres: d.codeBarres ?? null,
        },
      });
    }
    await tx.journalAction.create({
      data: {
        auteurId,
        action: "IMPORT_PRODUITS",
        entite: "Produit",
        detail: { fichier: nomFichier, crees: valides.length },
      },
    });
  });

  return { crees: valides.length, erreurs: [] };
}

export async function modeleImportXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Produits");
  ws.addRow([...COLONNES_MODELE]);
  ws.getRow(1).font = { bold: true };
  ws.addRow(["RIZ25", "Riz parfumé 25 kg", "Céréales", "kg", 12000, 15000, 50, "non", "6001234567890"]);
  ws.addRow(["HUI5", "Huile végétale 5 L", "Huiles", "L", 6000, 7500, 20, "oui", ""]);
  ws.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

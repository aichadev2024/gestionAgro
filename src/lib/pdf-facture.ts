import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "@/lib/format";
import { MARQUE } from "@/lib/marque";

export type DonneesFacture = {
  numero: string;
  date: Date;
  statut: "VALIDEE" | "ANNULEE";
  client: string;
  caissier: string;
  remise: number;
  total: number;
  lignes: { produit: string; quantite: string; unite: string; prix: number; montant: number }[];
  paiements: { mode: string; montant: number }[];
};

const VERT = rgb(0.12, 0.36, 0.2);
const ORANGE = rgb(0.94, 0.54, 0.14);
const GRIS = rgb(0.4, 0.4, 0.4);

const fcfa = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n).replace(/[  ]/g, " ")} FCFA`;

/** Les polices standard du PDF ne contiennent pas tous les caractères Unicode : on remplace le reste. */
const sur = (t: string) => t.replace(/[^\x20-\x7E -ÿ]/g, "?");

/** Facture PDF (A4) générée côté serveur. */
export async function genererFacturePdf(f: DonneesFacture): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${f.numero}`);
  pdf.setAuthor(MARQUE.nom);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);

  const L = 595;
  const marge = 50;
  let page = pdf.addPage([L, 842]);
  let y = 790;

  const texte = (p: PDFPage, t: string, x: number, yy: number, taille: number, police: PDFFont, couleur = rgb(0.1, 0.1, 0.1)) =>
    p.drawText(sur(t), { x, y: yy, size: taille, font: police, color: couleur });
  const droite = (p: PDFPage, t: string, xDroit: number, yy: number, taille: number, police: PDFFont, couleur = rgb(0.1, 0.1, 0.1)) =>
    texte(p, t, xDroit - police.widthOfTextAtSize(sur(t), taille), yy, taille, police, couleur);

  // En-tête
  page.drawRectangle({ x: 0, y: 770, width: L, height: 72, color: VERT });
  texte(page, MARQUE.nom.toUpperCase(), marge, 805, 24, gras, rgb(1, 1, 1));
  texte(page, MARQUE.slogan.toUpperCase(), marge, 788, 8, gras, ORANGE);
  droite(page, "FACTURE", L - marge, 805, 20, gras, rgb(1, 1, 1));
  droite(page, f.numero, L - marge, 788, 11, normal, rgb(1, 1, 1));

  y = 740;
  texte(page, `Date : ${formatDate(f.date)}`, marge, y, 10, normal, GRIS);
  texte(page, `Client : ${f.client}`, marge, y - 15, 10, normal);
  texte(page, `Caissier : ${f.caissier}`, marge, y - 30, 10, normal, GRIS);
  if (f.statut === "ANNULEE") {
    page.drawText("ANNULEE", { x: 380, y: 705, size: 30, font: gras, color: rgb(0.84, 0.25, 0.17), rotate: degrees(12) });
  }
  y -= 65;

  // Colonnes du tableau
  const xProduit = marge;
  const xQte = 330;
  const xPrix = 430;
  const xMontant = L - marge;

  const enteteTableau = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: marge - 5, y: yy - 6, width: L - 2 * marge + 10, height: 22, color: rgb(0.91, 0.95, 0.92) });
    texte(p, "Produit", xProduit, yy, 9, gras, VERT);
    droite(p, "Quantité", xQte + 40, yy, 9, gras, VERT);
    droite(p, "Prix unitaire", xPrix + 40, yy, 9, gras, VERT);
    droite(p, "Montant", xMontant, yy, 9, gras, VERT);
  };
  enteteTableau(page, y);
  y -= 26;

  for (const l of f.lignes) {
    if (y < 120) {
      page = pdf.addPage([L, 842]);
      y = 790;
      enteteTableau(page, y);
      y -= 26;
    }
    texte(page, l.produit.slice(0, 42), xProduit, y, 10, normal);
    droite(page, `${l.quantite} ${l.unite}`, xQte + 40, y, 10, normal);
    droite(page, fcfa(l.prix), xPrix + 40, y, 10, normal);
    droite(page, fcfa(l.montant), xMontant, y, 10, normal);
    page.drawLine({ start: { x: marge, y: y - 6 }, end: { x: L - marge, y: y - 6 }, thickness: 0.4, color: rgb(0.88, 0.88, 0.88) });
    y -= 22;
  }

  // Totaux
  if (y < 150) {
    page = pdf.addPage([L, 842]);
    y = 790;
  }
  y -= 8;
  if (f.remise > 0) {
    droite(page, `Remise : -${fcfa(f.remise)}`, xMontant, y, 10, normal, GRIS);
    y -= 20;
  }
  droite(page, `TOTAL : ${fcfa(f.total)}`, xMontant, y, 15, gras, VERT);
  y -= 26;
  for (const p of f.paiements) {
    droite(page, `${p.mode} : ${fcfa(p.montant)}`, xMontant, y, 10, normal, GRIS);
    y -= 15;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    texte(p, `${MARQUE.nom} ${MARQUE.signature}  -  Merci pour votre confiance`, marge, 30, 8, normal, GRIS);
    droite(p, `Page ${i + 1} / ${pages.length}`, L - marge, 30, 8, normal, GRIS);
  });

  return pdf.save();
}

import ExcelJS from "exceljs";

export const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Génère un classeur Excel d'une feuille, avec en-têtes en gras et colonnes ajustées. */
export async function classeurExcel(
  titreFeuille: string,
  entetes: string[],
  lignes: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sahelia";
  const ws = wb.addWorksheet(titreFeuille.slice(0, 31));
  ws.addRow(entetes);
  const ligneEntete = ws.getRow(1);
  ligneEntete.font = { bold: true, color: { argb: "FFFFFFFF" } };
  ligneEntete.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5D34" } };

  for (const l of lignes) {
    // Un texte qui commence par = + - @ serait interprété comme une formule : on le neutralise.
    ws.addRow(l.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v)));
  }
  ws.columns.forEach((col, i) => {
    const largeur = Math.max(
      entetes[i]?.length ?? 8,
      ...lignes.map((l) => String(l[i] ?? "").length),
    );
    col.width = Math.min(Math.max(largeur + 2, 10), 50);
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function reponseXlsx(contenu: Buffer, nomFichier: string) {
  return new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": TYPE_XLSX,
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

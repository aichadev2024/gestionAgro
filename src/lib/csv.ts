/** CSV compatible Excel en français : séparateur « ; » et BOM UTF-8 pour les accents. */
export function versCsv(entetes: string[], lignes: (string | number)[][]): string {
  const cellule = (v: string | number) => {
    const s = String(v);
    // Neutralise l'injection de formule dans Excel.
    const sur = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
  };
  const corps = [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
  return `﻿${corps}\r\n`;
}

export function reponseCsv(contenu: string, nomFichier: string) {
  return new Response(contenu, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

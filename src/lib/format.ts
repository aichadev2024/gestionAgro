export function formatFCFA(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant).replace(/[  ]/g, " ")} FCFA`;
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${jj}/${mm}/${d.getFullYear()}`;
}

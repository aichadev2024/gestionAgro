const STYLES: Record<string, { libelle: string; classe: string }> = {
  BROUILLON: { libelle: "Brouillon", classe: "bg-gray-100 text-gray-600" },
  COMMANDE: { libelle: "Commandé", classe: "bg-accent-soft text-orange-700" },
  RECU_PARTIEL: { libelle: "Reçu partiellement", classe: "bg-yellow-100 text-yellow-800" },
  RECU: { libelle: "Reçu", classe: "bg-brand-soft text-brand" },
  ANNULE: { libelle: "Annulé", classe: "bg-red-50 text-tomate" },
};

export function StatutAchat({ statut }: { statut: string }) {
  const s = STYLES[statut] ?? STYLES.BROUILLON;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.classe}`}>
      {s.libelle}
    </span>
  );
}

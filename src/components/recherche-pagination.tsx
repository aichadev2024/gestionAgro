import Link from "next/link";

export const PAR_PAGE = 25;

export function lirePage(valeur: string | string[] | undefined) {
  const n = Number(Array.isArray(valeur) ? valeur[0] : valeur);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function lireTexte(valeur: string | string[] | undefined) {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v?.trim() ? v.trim().slice(0, 80) : undefined;
}

/** Champ de recherche (formulaire GET, sans JavaScript). */
export function Recherche({
  action,
  valeur,
  placeholder = "Rechercher…",
}: {
  action: string;
  valeur?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="flex gap-2 print:hidden">
      <input
        name="q"
        defaultValue={valeur}
        placeholder={placeholder}
        className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
      />
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
        Chercher
      </button>
      {valeur && (
        <Link href={action} className="self-center text-sm text-gray-500 hover:underline">
          Effacer
        </Link>
      )}
    </form>
  );
}

/** Pagination précédent / suivant qui conserve la recherche en cours. */
export function Pagination({
  page,
  total,
  chemin,
  recherche,
}: {
  page: number;
  total: number;
  chemin: string;
  recherche?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  if (pages <= 1) {
    return <p className="text-xs text-gray-500">{total} résultat(s)</p>;
  }
  const lien = (p: number) => {
    const q = new URLSearchParams();
    if (recherche) q.set("q", recherche);
    q.set("page", String(p));
    return `${chemin}?${q.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm print:hidden">
      <span className="text-gray-500">
        {total} résultat(s) · page {page} / {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={lien(page - 1)} className="rounded-lg bg-brand-soft px-3 py-1.5 font-semibold text-brand">
            ← Précédent
          </Link>
        )}
        {page < pages && (
          <Link href={lien(page + 1)} className="rounded-lg bg-brand-soft px-3 py-1.5 font-semibold text-brand">
            Suivant →
          </Link>
        )}
      </div>
    </div>
  );
}

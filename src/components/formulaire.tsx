"use client";

import { useActionState, useEffect, useRef } from "react";
import type { EtatFormulaire } from "@/lib/erreurs";

export const classeChamp =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-brand";

export function Champ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {children}
    </label>
  );
}

/** Formulaire branché sur une Server Action : affiche l'erreur et se vide après succès. */
export function Formulaire({
  action,
  children,
  libelleBouton,
  vider = true,
  className = "space-y-3",
}: {
  action: (etat: EtatFormulaire, fd: FormData) => Promise<EtatFormulaire>;
  children: React.ReactNode;
  libelleBouton: string;
  vider?: boolean;
  className?: string;
}) {
  const [etat, soumettre, enCours] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat?.ok && vider) ref.current?.reset();
  }, [etat, vider]);

  return (
    <form ref={ref} action={soumettre} className={className}>
      {children}
      {etat?.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
      {etat?.ok && <p className="text-sm text-brand">Enregistré.</p>}
      <button
        disabled={enCours}
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : libelleBouton}
      </button>
    </form>
  );
}

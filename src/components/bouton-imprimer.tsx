"use client";

export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 print:hidden"
    >
      Imprimer / PDF
    </button>
  );
}

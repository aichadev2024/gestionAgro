"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import type { ModuleMenu } from "@/lib/roles";

export function NavMenu({
  items,
  libelleRole,
  deconnexion,
}: {
  items: Pick<ModuleMenu, "href" | "libelle">[];
  libelleRole: string;
  deconnexion: () => Promise<void>;
}) {
  const pathname = usePathname();
  const actif = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 md:px-6 print:hidden">
      <header className="flex items-center justify-between rounded-2xl bg-brand px-5 py-5 shadow-lg md:px-8 md:py-6">
        <Logo variante="sombre" taille={46} />
        <span className="rounded-full border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent">
          {libelleRole}
        </span>
      </header>

      <div className="mt-4 flex items-center gap-3 border-b border-gray-200 pb-4">
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {items.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                actif(m.href)
                  ? "bg-brand text-white shadow"
                  : "text-gray-600 hover:bg-brand-soft"
              }`}
            >
              {m.libelle}
            </Link>
          ))}
        </nav>
        <form action={deconnexion}>
          <button className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide shadow-sm hover:bg-gray-50">
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}

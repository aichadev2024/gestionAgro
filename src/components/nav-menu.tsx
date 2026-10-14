"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import type { ModuleMenu } from "@/lib/roles";

export function NavMenu({
  items,
  libelleRole,
  nbNotifications,
  urgent,
  deconnexion,
}: {
  items: Pick<ModuleMenu, "href" | "libelle">[];
  libelleRole: string;
  nbNotifications: number;
  urgent: boolean;
  deconnexion: () => Promise<void>;
}) {
  const pathname = usePathname();
  const actif = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 md:px-6 print:hidden">
      <header className="flex items-center justify-between rounded-2xl bg-brand px-5 py-5 shadow-lg md:px-8 md:py-6">
        <Logo variante="sombre" taille={46} />
        <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          title="Notifications"
          aria-label={`Notifications : ${nbNotifications}`}
          className="relative rounded-full border border-white/20 bg-white/10 p-2.5 text-white hover:bg-white/20"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {nbNotifications > 0 && (
            <span
              className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${
                urgent ? "bg-tomate" : "bg-accent"
              }`}
            >
              {nbNotifications > 99 ? "99+" : nbNotifications}
            </span>
          )}
        </Link>
        <Link
          href="/profil"
          title="Mon profil et mot de passe"
          className="rounded-full border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25"
        >
          {libelleRole} · Mon profil
        </Link>
        </div>
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

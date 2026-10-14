import { Suspense } from "react";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/session";
import { LIBELLE_ROLE, menuPourRole } from "@/lib/roles";
import { deconnexion } from "@/server/actions/auth";
import { NavMenu } from "@/components/nav-menu";
import { notificationsPour } from "@/server/services/notifications";
import { MARQUE } from "@/lib/marque";

async function Coquille({ children }: { children: React.ReactNode }) {
  const user = await utilisateurCourant();
  if (!user) redirect("/deconnexion");

  const { role } = user;
  // Les alertes ne doivent jamais empêcher d'afficher l'application.
  const notifications = await notificationsPour(user).catch(() => []);
  const items = menuPourRole(role).map(({ href, libelle }) => ({ href, libelle }));

  return (
    <div className="min-h-screen bg-background">
      <NavMenu
        items={items}
        libelleRole={LIBELLE_ROLE[role]}
        nbNotifications={notifications.filter((n) => n.niveau !== "info").length}
        urgent={notifications.some((n) => n.niveau === "critique")}
        deconnexion={deconnexion}
      />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
        <Suspense fallback={<p className="text-gray-500">Chargement…</p>}>{children}</Suspense>
      </main>
      <footer className="pb-6 text-center text-xs text-gray-400 print:hidden">
        {MARQUE.nom} {MARQUE.signature}
      </footer>
    </div>
  );
}

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Chargement…</div>}>
      <Coquille>{children}</Coquille>
    </Suspense>
  );
}

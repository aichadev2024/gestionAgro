import { Suspense } from "react";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/session";
import { LIBELLE_ROLE, menuPourRole } from "@/lib/roles";
import { deconnexion } from "@/server/actions/auth";
import { NavMenu } from "@/components/nav-menu";

async function Coquille({ children }: { children: React.ReactNode }) {
  const user = await utilisateurCourant();
  if (!user) redirect("/deconnexion");

  const { role } = user;
  const items = menuPourRole(role).map(({ href, libelle }) => ({ href, libelle }));

  return (
    <div className="min-h-screen bg-background">
      <NavMenu items={items} libelleRole={LIBELLE_ROLE[role]} deconnexion={deconnexion} />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
        <Suspense fallback={<p className="text-gray-500">Chargement…</p>}>{children}</Suspense>
      </main>
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

import { exigerAccesModule } from "@/lib/acces-page";
import { formatFCFA } from "@/lib/format";
import { LIBELLE_ROLE } from "@/lib/roles";
import { VentesParJour } from "@/components/graphiques-ventes";
import { indicateursDuJour } from "@/server/services/dashboard";
import { statistiquesVentes } from "@/server/services/statistiques";

const COULEURS = {
  navy: "border-l-brand bg-brand-soft text-brand",
  bleu: "border-l-accent bg-accent-soft text-accent",
  orange: "border-l-yellow-500 bg-yellow-50 text-yellow-600",
  vert: "border-l-lime-600 bg-lime-50 text-lime-700",
  rouge: "border-l-tomate bg-red-50 text-tomate",
} as const;

function Carte({
  libelle,
  valeur,
  teinte,
}: {
  libelle: string;
  valeur: string | number;
  teinte: keyof typeof COULEURS;
}) {
  const [bordure, ...pastille] = COULEURS[teinte].split(" ");
  return (
    <div className={`flex items-center gap-4 rounded-2xl border border-gray-100 border-l-4 bg-white p-5 shadow-sm ${bordure}`}>
      <div className={`h-12 w-12 shrink-0 rounded-xl ${pastille.join(" ")}`} />
      <div>
        <div className="text-sm text-gray-500">{libelle}</div>
        <div className="text-3xl font-extrabold text-gray-900">{valeur}</div>
      </div>
    </div>
  );
}

export default async function TableauDeBord() {
  const user = await exigerAccesModule("/");
  const [k, semaine] = await Promise.all([indicateursDuJour(), statistiquesVentes(7)]);
  const initiales = user.name
    .split(" ")
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-extrabold text-brand md:text-3xl">
            Ravi de vous revoir, {user.name} ! 👋
          </h1>
          <p className="mt-3 text-gray-600">
            Votre tableau de bord est prêt. Suivez en temps réel les ventes, les stocks par lot
            et les achats en cours de votre entreprise.
          </p>
          <blockquote className="mt-5 border-l-4 border-accent bg-accent-soft/50 px-4 py-3 text-sm italic text-gray-600">
            « Un stock bien suivi, c&apos;est une entreprise qui respire. »
          </blockquote>
        </section>

        <section className="flex items-center gap-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-extrabold text-white">
            {initiales}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-accent">
              {LIBELLE_ROLE[user.role]}
            </div>
            <div className="truncate text-xl font-extrabold text-brand">{user.name}</div>
            <div className="truncate text-sm text-gray-500">{user.email}</div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Carte libelle="Ventes du jour" valeur={k.nbVentes} teinte="navy" />
        <Carte libelle="Achats en cours" valeur={k.achatsEnCours} teinte="bleu" />
        <Carte libelle="Stock bas" valeur={k.stockBas} teinte="orange" />
        <Carte libelle="Péremption sous 30 j" valeur={k.lotsProchesPeremption} teinte="rouge" />
        <Carte libelle="Montant du jour" valeur={formatFCFA(k.montantVentes)} teinte="vert" />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-brand">Ventes des 7 derniers jours</h2>
        <VentesParJour donnees={semaine.parJour} />
      </section>
    </div>
  );
}

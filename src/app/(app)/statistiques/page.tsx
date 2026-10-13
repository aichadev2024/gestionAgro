import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { formatFCFA } from "@/lib/format";
import {
  GraphePeriode,
  RepartitionPaiements,
  TopProduits,
} from "@/components/graphiques-ventes";
import { BoutonImprimer } from "@/components/bouton-imprimer";
import {
  NOMS_MOIS,
  libellePeriode,
  periodePrecedente,
  periodeSuivante,
  situationActuelle,
  statistiquesPeriode,
  type Periode,
} from "@/server/services/statistiques";

const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function lirePeriode(sp: Record<string, string | string[] | undefined>): Periode {
  const maintenant = new Date();
  const annee = Number(param(sp.annee)) || maintenant.getFullYear();
  const mois = Number(param(sp.mois)) || maintenant.getMonth() + 1;
  if (param(sp.vue) === "annee") return { vue: "annee", annee };
  return { vue: "mois", annee, mois: Math.min(Math.max(mois, 1), 12) };
}

function lien(p: Periode) {
  return p.vue === "mois"
    ? `/statistiques?vue=mois&annee=${p.annee}&mois=${p.mois}`
    : `/statistiques?vue=annee&annee=${p.annee}`;
}

function Variation({ actuel, precedent }: { actuel: number; precedent: number }) {
  if (precedent === 0) {
    return <span className="text-xs text-gray-400">{actuel === 0 ? "—" : "nouveau"}</span>;
  }
  const pct = Math.round(((actuel - precedent) / Math.abs(precedent)) * 100);
  const bon = pct >= 0;
  return (
    <span className={`text-xs font-semibold ${bon ? "text-brand" : "text-tomate"}`}>
      {bon ? "▲" : "▼"} {Math.abs(pct)} % vs précédent
    </span>
  );
}

function Kpi({
  titre,
  valeur,
  classe,
  actuel,
  precedent,
  aide,
}: {
  titre: string;
  valeur: string;
  classe: string;
  actuel?: number;
  precedent?: number;
  aide?: string;
}) {
  return (
    <div className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${classe}`}>
      <div className="text-sm text-gray-500">{titre}</div>
      <div className="text-2xl font-extrabold text-gray-900">{valeur}</div>
      <div className="mt-1 min-h-4">
        {actuel !== undefined && precedent !== undefined ? (
          <Variation actuel={actuel} precedent={precedent} />
        ) : (
          aide && <span className="text-xs text-gray-400">{aide}</span>
        )}
      </div>
    </div>
  );
}

function Classement({
  titre,
  lignes,
}: {
  titre: string;
  lignes: { nom: string; ca: number; detail?: string }[];
}) {
  const max = Math.max(...lignes.map((l) => l.ca), 1);
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-brand">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune donnée sur la période.</p>
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.nom}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium">{l.nom}</span>
                <span className="font-semibold">{formatFCFA(l.ca)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-brand-soft">
                <div
                  className="h-2 rounded-full bg-brand"
                  style={{ width: `${Math.round((l.ca / max) * 100)}%` }}
                />
              </div>
              {l.detail && <div className="mt-0.5 text-xs text-gray-500">{l.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PageStatistiques({ searchParams }: PageProps<"/statistiques">) {
  await exigerAccesModule("/statistiques");
  const periode = lirePeriode(await searchParams);
  const precedente = periodePrecedente(periode);

  const [s, prec, actuel] = await Promise.all([
    statistiquesPeriode(periode),
    statistiquesPeriode(precedente),
    situationActuelle(),
  ]);
  const r = s.resume;
  const rp = prec.resume;

  const maintenant = new Date();
  const anneeCourante = maintenant.getFullYear();
  const moisCourant: Periode = { vue: "mois", annee: anneeCourante, mois: maintenant.getMonth() + 1 };
  const annees = Array.from({ length: 8 }, (_, i) => anneeCourante - i);
  const parametresExport =
    periode.vue === "mois"
      ? `vue=mois&annee=${periode.annee}&mois=${periode.mois}`
      : `vue=annee&annee=${periode.annee}`;

  const donneesGraphe = s.serie.map((pt, i) => ({
    label: pt.label,
    ca: pt.ca,
    marge: pt.marge,
    caPrecedent: prec.serie[i]?.ca,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand">Statistiques</h1>
          <p className="text-gray-600">
            {libellePeriode(periode)} · comparé à {libellePeriode(precedente)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <a
            href={`/api/export/ventes?${parametresExport}`}
            className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
          >
            Exporter les ventes (Excel)
          </a>
          {/* Téléchargement de fichier : un lien classique est voulu, pas une navigation Next. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/export/stock"
            className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
          >
            Exporter le stock (Excel)
          </a>
          <BoutonImprimer />
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={lien(precedente)} className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
            ← {libellePeriode(precedente)}
          </Link>
          <Link href={lien(periodeSuivante(periode))} className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
            {libellePeriode(periodeSuivante(periode))} →
          </Link>
          <span className="mx-2 hidden h-6 border-l border-gray-200 sm:block" />
          <Link href={lien(moisCourant)} className="rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-brand-soft">
            Ce mois
          </Link>
          <Link href={lien(periodePrecedente(moisCourant))} className="rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-brand-soft">
            Mois dernier
          </Link>
          <Link href={lien({ vue: "annee", annee: anneeCourante })} className="rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-brand-soft">
            Cette année
          </Link>
          <Link href={lien({ vue: "annee", annee: anneeCourante - 1 })} className="rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:bg-brand-soft">
            Année dernière
          </Link>
        </div>
        <form method="get" action="/statistiques" className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700">
            Affichage
            <select name="vue" defaultValue={periode.vue} className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="mois">Un mois</option>
              <option value="annee">Une année entière</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Mois
            <select
              name="mois"
              defaultValue={periode.vue === "mois" ? periode.mois : maintenant.getMonth() + 1}
              className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              {NOMS_MOIS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Année
            <select name="annee" defaultValue={periode.annee} className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2">
              {[...new Set([...annees, periode.annee])].sort((a, b) => b - a).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white">Afficher</button>
        </form>
      </section>

      <section
        className={`rounded-3xl p-6 text-white shadow-lg md:p-8 ${r.resultat >= 0 ? "bg-brand" : "bg-tomate"}`}
      >
        <div className="text-sm font-semibold uppercase tracking-wider text-white/80">
          Gain net estimé · {libellePeriode(periode)}
        </div>
        <div className="mt-1 text-4xl font-extrabold md:text-5xl">{formatFCFA(r.resultat)}</div>
        <div className="mt-2 text-sm text-white/85">
          Marge brute {formatFCFA(r.marge)}
          {r.pertes > 0 && ` − pertes ${formatFCFA(r.pertes)}`}
          {r.ecartInventaire !== 0 && ` ${r.ecartInventaire < 0 ? "−" : "+"} écarts d'inventaire ${formatFCFA(Math.abs(r.ecartInventaire))}`}
          {" · "}
          <span className="font-semibold">
            période précédente : {formatFCFA(rp.resultat)}
          </span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titre="Chiffre d'affaires" valeur={formatFCFA(r.ca)} classe="border-l-brand" actuel={r.ca} precedent={rp.ca} />
        <Kpi titre={`Marge brute (${r.tauxMarge} %)`} valeur={formatFCFA(r.marge)} classe="border-l-accent" actuel={r.marge} precedent={rp.marge} />
        <Kpi titre="Nombre de ventes" valeur={String(r.nbVentes)} classe="border-l-lime-600" actuel={r.nbVentes} precedent={rp.nbVentes} />
        <Kpi titre="Panier moyen" valeur={formatFCFA(r.panierMoyen)} classe="border-l-yellow-500" actuel={r.panierMoyen} precedent={rp.panierMoyen} />
        <Kpi titre="Achats (commandes)" valeur={formatFCFA(r.achats)} classe="border-l-orange-400" actuel={r.achats} precedent={rp.achats} aide={`${r.nbAchats} commande(s)`} />
        <Kpi titre="Encaissé (espèces + mobile)" valeur={formatFCFA(r.encaisse)} classe="border-l-brand" aide="Hors ventes à crédit" />
        <Kpi titre="Vendu à crédit" valeur={formatFCFA(r.credits)} classe="border-l-yellow-600" actuel={r.credits} precedent={rp.credits} />
        <Kpi titre="Remises accordées" valeur={formatFCFA(r.remises)} classe="border-l-gray-400" actuel={r.remises} precedent={rp.remises} />
        <Kpi titre="Pertes de stock" valeur={formatFCFA(r.pertes)} classe="border-l-tomate" actuel={r.pertes} precedent={rp.pertes} aide="Valeur au prix d'achat" />
        <Kpi
          titre="Écarts d'inventaire"
          valeur={`${r.ecartInventaire > 0 ? "+" : ""}${formatFCFA(r.ecartInventaire)}`}
          classe="border-l-tomate"
          aide="Négatif = manquant"
        />
        <Kpi titre="Productions" valeur={String(r.nbProductions)} classe="border-l-brand" aide={`Matières consommées : ${formatFCFA(r.coutProduction)}`} />
        <Kpi titre="Coût des produits vendus" valeur={formatFCFA(r.cmv)} classe="border-l-gray-400" actuel={r.cmv} precedent={rp.cmv} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-brand">
          {periode.vue === "annee" ? "Évolution mois par mois" : "Évolution jour par jour"}
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          La ligne grise montre {libellePeriode(precedente)} pour comparer.
        </p>
        <GraphePeriode donnees={donneesGraphe} />
      </section>

      {periode.vue === "annee" && (
        <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <h2 className="px-4 pt-4 text-lg font-bold text-brand">Détail par mois</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="bg-brand-soft text-xs uppercase text-brand">
              <tr>
                <th className="px-4 py-3">Mois</th>
                <th className="px-4 py-3 text-right">CA</th>
                <th className="px-4 py-3 text-right">Marge brute</th>
                <th className="px-4 py-3 text-right">Achats</th>
                <th className="px-4 py-3 text-right">CA {precedente.annee}</th>
                <th className="px-4 py-3 text-right">Évolution</th>
              </tr>
            </thead>
            <tbody>
              {s.serie.map((pt, i) => (
                <tr key={pt.label} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{NOMS_MOIS[i]}</td>
                  <td className="px-4 py-2 text-right">{formatFCFA(pt.ca)}</td>
                  <td className="px-4 py-2 text-right">{formatFCFA(pt.marge)}</td>
                  <td className="px-4 py-2 text-right">{formatFCFA(pt.achats)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatFCFA(prec.serie[i]?.ca ?? 0)}</td>
                  <td className="px-4 py-2 text-right">
                    <Variation actuel={pt.ca} precedent={prec.serie[i]?.ca ?? 0} />
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-brand bg-brand-soft/50 font-bold">
                <td className="px-4 py-3">Total {periode.annee}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(r.ca)}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(r.marge)}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(r.achats)}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(rp.ca)}</td>
                <td className="px-4 py-3 text-right">
                  <Variation actuel={r.ca} precedent={rp.ca} />
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-brand">Meilleurs produits</h2>
          {s.topProduits.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune vente sur la période.</p>
          ) : (
            <TopProduits donnees={s.topProduits} />
          )}
        </section>
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-brand">Modes de paiement</h2>
          {s.modes.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun paiement sur la période.</p>
          ) : (
            <RepartitionPaiements donnees={s.modes} />
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Classement
          titre="Par catégorie"
          lignes={s.categories.map((c) => ({
            nom: c.nom,
            ca: c.ca,
            detail: `Marge ${formatFCFA(c.marge)}`,
          }))}
        />
        <Classement
          titre="Par caissier"
          lignes={s.caissiers.map((c) => ({ nom: c.nom, ca: c.ca, detail: `${c.nb} vente(s)` }))}
        />
        <Classement
          titre="Meilleurs clients"
          lignes={s.clients.map((c) => ({ nom: c.nom, ca: c.ca, detail: `${c.nb} achat(s)` }))}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Kpi titre="Valeur du stock aujourd'hui" valeur={formatFCFA(actuel.valeurStock)} classe="border-l-brand" aide="Au prix d'achat, tous dépôts" />
        <Kpi titre="Créances clients aujourd'hui" valeur={formatFCFA(actuel.creancesClients)} classe="border-l-yellow-600" aide="Argent dû par les clients à crédit" />
      </section>
    </div>
  );
}

import Link from "next/link";
import { exigerAccesModule } from "@/lib/acces-page";
import { notificationsPour, type Niveau } from "@/server/services/notifications";

const STYLE: Record<Niveau, { libelle: string; bordure: string; pastille: string }> = {
  critique: { libelle: "Urgent", bordure: "border-l-tomate", pastille: "bg-red-50 text-tomate" },
  attention: { libelle: "À surveiller", bordure: "border-l-accent", pastille: "bg-accent-soft text-orange-700" },
  info: { libelle: "Information", bordure: "border-l-brand", pastille: "bg-brand-soft text-brand" },
};

export default async function PageNotifications() {
  const user = await exigerAccesModule("/notifications");
  const notifications = await notificationsPour(user);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand">Notifications</h1>
        <p className="text-sm text-gray-500">
          Ces alertes se mettent à jour toutes seules : elles disparaissent dès que le problème est réglé.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">✅</div>
          <p className="mt-2 font-semibold text-brand">Tout est en ordre</p>
          <p className="text-sm text-gray-500">Aucune alerte pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => {
            const s = STYLE[n.niveau];
            return (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className={`block rounded-2xl border border-gray-100 border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md ${s.bordure}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.pastille}`}>
                      {s.libelle}
                    </span>
                    <span className="text-xs text-gray-400">{n.categorie}</span>
                  </div>
                  <div className="mt-1 font-semibold text-gray-900">{n.titre}</div>
                  <div className="text-sm text-gray-600">{n.detail}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

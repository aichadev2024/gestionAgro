import { exigerAccesModule } from "@/lib/acces-page";
import { formatDate } from "@/lib/format";
import { LIBELLE_ROLE, ROLES } from "@/lib/roles";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import {
  basculerActifAction,
  changerRoleAction,
  creerUtilisateurAction,
  reinitialiserMdpAction,
} from "@/server/actions/utilisateurs";
import { derniersJournaux, listerUtilisateurs } from "@/server/services/utilisateurs";

const LIBELLE_ACTION: Record<string, string> = {
  CREATION_PRODUIT: "Création de produit",
  MODIFICATION_PRIX: "Modification de prix",
  DESACTIVATION_PRODUIT: "Désactivation de produit",
  REACTIVATION_PRODUIT: "Réactivation de produit",
  ANNULATION_ACHAT: "Annulation d'achat",
  ANNULATION_VENTE: "Annulation de vente",
  REMISE_VENTE: "Remise sur vente",
  PERTE_STOCK: "Perte de stock",
  AJUSTEMENT_INVENTAIRE: "Ajustement d'inventaire",
  ANNULATION_PRODUCTION: "Annulation de production",
  CREATION_UTILISATEUR: "Création d'utilisateur",
  CHANGEMENT_ROLE: "Changement de rôle",
  DESACTIVATION_UTILISATEUR: "Désactivation d'utilisateur",
  REACTIVATION_UTILISATEUR: "Réactivation d'utilisateur",
  REINITIALISATION_MOT_DE_PASSE: "Réinitialisation de mot de passe",
};

export default async function PageUtilisateurs() {
  const moi = await exigerAccesModule("/utilisateurs");
  const [utilisateurs, journal] = await Promise.all([listerUtilisateurs(), derniersJournaux()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Utilisateurs</h1>

      <section className="space-y-3">
        {utilisateurs.map((u) => (
          <details
            key={u.id}
            className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="font-semibold">{u.nom}</span>
              <span className="text-sm text-gray-500">{u.email}</span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                {LIBELLE_ROLE[u.role]}
              </span>
              {!u.actif && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-tomate">
                  Désactivé
                </span>
              )}
              {u.id === moi.id && <span className="text-xs text-gray-400">(vous)</span>}
            </summary>

            {u.id !== moi.id && (
              <div className="mt-4 grid gap-5 border-t border-gray-100 pt-4 md:grid-cols-3">
                <Formulaire
                  action={changerRoleAction.bind(null, u.id)}
                  libelleBouton="Changer le rôle"
                  vider={false}
                >
                  <Champ label="Rôle">
                    <select name="role" defaultValue={u.role} className={classeChamp}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {LIBELLE_ROLE[r]}
                        </option>
                      ))}
                    </select>
                  </Champ>
                </Formulaire>

                <Formulaire
                  action={reinitialiserMdpAction.bind(null, u.id)}
                  libelleBouton="Réinitialiser"
                >
                  <Champ label="Nouveau mot de passe (8 caractères min.)">
                    <input name="motDePasse" type="password" autoComplete="new-password" required className={classeChamp} />
                  </Champ>
                </Formulaire>

                <div>
                  <Formulaire
                    action={basculerActifAction.bind(null, u.id)}
                    libelleBouton={u.actif ? "Désactiver le compte" : "Réactiver le compte"}
                    vider={false}
                  >
                    <p className="text-sm text-gray-500">
                      {u.actif
                        ? "Le compte perd l'accès immédiatement. Son historique est conservé."
                        : "Le compte retrouve son accès."}
                    </p>
                  </Formulaire>
                </div>
              </div>
            )}
          </details>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Nouvel utilisateur</h2>
        <Formulaire action={creerUtilisateurAction} libelleBouton="Créer le compte">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom">
              <input name="nom" required className={classeChamp} />
            </Champ>
            <Champ label="Email">
              <input name="email" type="email" required autoComplete="off" className={classeChamp} />
            </Champ>
            <Champ label="Rôle">
              <select name="role" required defaultValue="CAISSIER" className={classeChamp}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {LIBELLE_ROLE[r]}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Mot de passe initial (8 caractères min.)">
              <input name="motDePasse" type="password" autoComplete="new-password" required className={classeChamp} />
            </Champ>
          </div>
        </Formulaire>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="px-4 pt-4 text-lg font-bold text-brand">Journal des actions sensibles</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Détail</th>
            </tr>
          </thead>
          <tbody>
            {journal.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  Aucune action enregistrée.
                </td>
              </tr>
            )}
            {journal.map((j) => (
              <tr key={j.id} className="border-t border-gray-100 align-top">
                <td className="whitespace-nowrap px-4 py-2">{formatDate(j.creeLe)}</td>
                <td className="px-4 py-2">{j.auteur.nom}</td>
                <td className="px-4 py-2 font-medium">{LIBELLE_ACTION[j.action] ?? j.action}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {j.detail ? JSON.stringify(j.detail) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

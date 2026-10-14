import { exigerAccesModule } from "@/lib/acces-page";
import { LIBELLE_ROLE } from "@/lib/roles";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { prisma } from "@/lib/prisma";
import {
  changerMonMotDePasseAction,
  envoyerEmailTestAction,
  preferenceAlertesAction,
} from "@/server/actions/utilisateurs";

export default async function PageProfil() {
  const user = await exigerAccesModule("/profil");
  const prefs = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { recoitAlertes: true },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-extrabold text-brand">Mon profil</h1>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="text-lg font-bold">{user.name}</div>
        <div className="text-sm text-gray-500">{user.email}</div>
        <div className="mt-2 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
          {LIBELLE_ROLE[user.role]}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-1 text-lg font-bold text-brand">Alertes par email</h2>
        <p className="mb-3 text-sm text-gray-500">
          Recevez chaque jour un résumé des alertes urgentes ou à surveiller de {user.email}. Aucun
          email n&apos;est envoyé s&apos;il n&apos;y a rien à signaler.
        </p>
        <Formulaire action={preferenceAlertesAction} libelleBouton="Enregistrer" vider={false}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="recoitAlertes" defaultChecked={prefs.recoitAlertes} className="h-4 w-4" />
            Recevoir le résumé quotidien par email
          </label>
        </Formulaire>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <Formulaire action={envoyerEmailTestAction} libelleBouton="Envoyer un email de test" vider={false}>
            <p className="text-xs text-gray-500">Vérifie que l&apos;envoi d&apos;emails fonctionne.</p>
          </Formulaire>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-3 text-lg font-bold text-brand">Changer mon mot de passe</h2>
        <Formulaire action={changerMonMotDePasseAction} libelleBouton="Changer le mot de passe">
          <Champ label="Mot de passe actuel">
            <input name="actuel" type="password" autoComplete="current-password" required className={classeChamp} />
          </Champ>
          <Champ label="Nouveau mot de passe (8 caractères minimum)">
            <input name="nouveau" type="password" autoComplete="new-password" required minLength={8} className={classeChamp} />
          </Champ>
          <Champ label="Confirmer le nouveau mot de passe">
            <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} className={classeChamp} />
          </Champ>
        </Formulaire>
        <p className="mt-4 text-xs text-gray-500">
          Mot de passe oublié ? Demandez à un administrateur de le réinitialiser depuis la page Utilisateurs.
        </p>
      </section>
    </div>
  );
}

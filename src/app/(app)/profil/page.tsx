import { exigerAccesModule } from "@/lib/acces-page";
import { LIBELLE_ROLE } from "@/lib/roles";
import { Champ, Formulaire, classeChamp } from "@/components/formulaire";
import { changerMonMotDePasseAction } from "@/server/actions/utilisateurs";

export default async function PageProfil() {
  const user = await exigerAccesModule("/profil");

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

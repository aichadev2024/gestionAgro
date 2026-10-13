"use client";

import { useActionState } from "react";
import { connexion } from "@/server/actions/auth";

export default function PageConnexion() {
  const [erreur, action, enCours] = useActionState(connexion, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
      >
        <h1 className="text-2xl font-bold text-brand">AgroGestion</h1>
        <p className="text-sm text-gray-500">Connectez-vous pour continuer</p>

        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          Mot de passe
          <input
            name="motDePasse"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-base"
          />
        </label>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-md bg-brand p-2.5 font-medium text-white disabled:opacity-60"
        >
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

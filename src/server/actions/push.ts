"use server";

import { z } from "zod";
import { exigerRole } from "@/lib/droits";
import { ErreurMetier, messageErreur, type EtatFormulaire } from "@/lib/erreurs";
import { MARQUE } from "@/lib/marque";
import {
  creerEnvoyeur,
  enregistrerAbonnement,
  pousserVersUtilisateurs,
  supprimerAbonnement,
} from "@/server/services/push";

const abonnementSchema = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function abonnerPush(abonnement: z.input<typeof abonnementSchema>): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole(); // tout utilisateur connecté, pour son propre appareil
    if (!creerEnvoyeur()) throw new ErreurMetier("Les notifications push ne sont pas encore configurées sur le serveur.");
    await enregistrerAbonnement(user.id, abonnementSchema.parse(abonnement));
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function desabonnerPush(endpoint: string): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole();
    await supprimerAbonnement(user.id, z.string().max(600).parse(endpoint));
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

export async function envoyerPushTest(): Promise<EtatFormulaire> {
  try {
    const user = await exigerRole();
    const envoyeur = creerEnvoyeur();
    if (!envoyeur) throw new ErreurMetier("Les notifications push ne sont pas encore configurées sur le serveur.");
    const bilan = await pousserVersUtilisateurs(
      [user.id],
      { title: `${MARQUE.nom} : notification de test`, body: "Les notifications fonctionnent sur cet appareil.", tag: "test" },
      envoyeur,
    );
    if (bilan.envoyes === 0) {
      throw new ErreurMetier("Aucun appareil n'a reçu la notification. Réactivez les notifications sur cet appareil.");
    }
    return { ok: true };
  } catch (e) {
    return { erreur: messageErreur(e) };
  }
}

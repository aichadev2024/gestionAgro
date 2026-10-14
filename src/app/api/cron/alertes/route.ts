import { timingSafeEqual } from "node:crypto";
import { creerTransport, envoyerResumes } from "@/server/services/alertes-email";
import { creerEnvoyeur, envoyerResumesPush } from "@/server/services/push";

export const dynamic = "force-dynamic";

/** Comparaison en temps constant, pour ne pas révéler le secret par le temps de réponse. */
function secretValide(fourni: string, attendu: string) {
  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Appelée chaque jour par une tâche planifiée (Coolify) : envoie le résumé par email et par notification push.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/alertes
 * Sans CRON_SECRET configuré, la route est désactivée (jamais ouverte au public).
 */
async function traiter(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return Response.json({ erreur: "CRON_SECRET non configuré (16 caractères minimum)." }, { status: 503 });
  }
  const entete = request.headers.get("authorization") ?? "";
  if (!entete.startsWith("Bearer ") || !secretValide(entete.slice(7), secret)) {
    return new Response("Accès refusé", { status: 401 });
  }

  const smtp = creerTransport();
  const envoyeurPush = creerEnvoyeur();
  const email = smtp
    ? await envoyerResumes(smtp.transport, smtp.expediteur)
    : { raison: "Envoi d'emails non configuré (variables SMTP_*)." };
  const push = envoyeurPush
    ? await envoyerResumesPush(envoyeurPush)
    : { raison: "Notifications push non configurées (clés VAPID)." };

  // Compatibilité : le nombre d'emails envoyés reste au premier niveau de la réponse.
  return Response.json({ envoyes: "envoyes" in email ? email.envoyes : 0, email, push });
}

export const GET = traiter;
export const POST = traiter;

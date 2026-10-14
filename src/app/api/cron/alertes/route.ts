import { timingSafeEqual } from "node:crypto";
import { creerTransport, envoyerResumes } from "@/server/services/alertes-email";

export const dynamic = "force-dynamic";

/** Comparaison en temps constant, pour ne pas révéler le secret par le temps de réponse. */
function secretValide(fourni: string, attendu: string) {
  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Appelée chaque jour par une tâche planifiée (Coolify) :
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
  if (!smtp) {
    return Response.json({ envoyes: 0, raison: "Envoi d'emails non configuré (variables SMTP_*)." });
  }
  const bilan = await envoyerResumes(smtp.transport, smtp.expediteur);
  return Response.json(bilan);
}

export const GET = traiter;
export const POST = traiter;

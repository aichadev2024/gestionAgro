import nodemailer from "nodemailer";
import { ErreurMetier } from "@/lib/erreurs";
import { MARQUE } from "@/lib/marque";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { notificationsPour, type Notification } from "@/server/services/notifications";

/** Ce dont on a besoin pour envoyer un email (nodemailer, ou un faux transport dans les tests). */
export type Transport = {
  sendMail(mail: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown>;
};

const DELAI_MINI_HEURES = 20; // au plus un résumé par jour et par personne

/** Transport SMTP construit depuis les variables d'environnement, ou null si l'envoi n'est pas configuré. */
export function creerTransport(): { transport: Transport; expediteur: string } | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  const port = Number(SMTP_PORT) || 587;
  return {
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }),
    expediteur: SMTP_FROM || `${MARQUE.nom} <${SMTP_USER}>`,
  };
}

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LIBELLE = { critique: "URGENT", attention: "À surveiller", info: "Info" } as const;
const COULEUR = { critique: "#d6402b", attention: "#f08a24", info: "#1f5d34" } as const;

export function composerResume(nom: string, alertes: Notification[], urlApp: string) {
  const lien = urlApp ? `${urlApp.replace(/\/$/, "")}/notifications` : "";
  const sujet = `${MARQUE.nom} : ${alertes.length} alerte(s) à traiter`;

  const texte = [
    `Bonjour ${nom},`,
    "",
    `Voici les alertes de ${MARQUE.nom} qui demandent votre attention :`,
    "",
    ...alertes.map((a) => `- [${LIBELLE[a.niveau]}] ${a.titre}\n  ${a.detail}`),
    "",
    lien ? `Ouvrir l'application : ${lien}` : "",
    "",
    `${MARQUE.nom} ${MARQUE.signature}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#faf6ec;font-family:Arial,Helvetica,sans-serif;color:#1f2a1c">
<div style="max-width:560px;margin:0 auto;padding:20px">
  <div style="background:#1f5d34;color:#fff;border-radius:12px;padding:16px 20px">
    <div style="font-size:20px;font-weight:bold;letter-spacing:2px">${echapper(MARQUE.nom.toUpperCase())}</div>
    <div style="font-size:11px;color:#f08a24;letter-spacing:2px">${echapper(MARQUE.slogan.toUpperCase())}</div>
  </div>
  <p>Bonjour ${echapper(nom)},</p>
  <p>Voici les alertes qui demandent votre attention :</p>
  ${alertes
    .map(
      (a) => `<div style="background:#fff;border-left:4px solid ${COULEUR[a.niveau]};border-radius:8px;padding:10px 14px;margin:10px 0">
    <div style="font-size:11px;font-weight:bold;color:${COULEUR[a.niveau]}">${LIBELLE[a.niveau]} · ${echapper(a.categorie)}</div>
    <div style="font-weight:bold">${echapper(a.titre)}</div>
    <div style="font-size:13px;color:#555">${echapper(a.detail)}</div>
  </div>`,
    )
    .join("")}
  ${lien ? `<p><a href="${echapper(lien)}" style="display:inline-block;background:#1f5d34;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Ouvrir ${echapper(MARQUE.nom)}</a></p>` : ""}
  <p style="font-size:12px;color:#888">${echapper(MARQUE.nom)} ${echapper(MARQUE.signature)} · Vous pouvez désactiver ce résumé depuis « Mon profil ».</p>
</div></body></html>`;

  return { sujet, texte, html };
}

/**
 * Envoie le résumé des alertes importantes (urgentes ou à surveiller) aux utilisateurs qui l'ont activé.
 * Une personne sans alerte importante ne reçoit rien ; une même personne reçoit au plus un résumé par jour.
 */
export async function envoyerResumes(
  transport: Transport,
  expediteur: string,
  options: { maintenant?: Date; urlApp?: string; forcer?: boolean } = {},
) {
  const maintenant = options.maintenant ?? new Date();
  const limite = new Date(maintenant.getTime() - DELAI_MINI_HEURES * 3600 * 1000);
  const bilan = { envoyes: 0, ignores: 0, erreurs: 0 };

  const destinataires = await prisma.user.findMany({
    where: { actif: true, recoitAlertes: true },
    select: { id: true, nom: true, email: true, role: true, derniereAlerteLe: true },
  });

  for (const u of destinataires) {
    if (!options.forcer && u.derniereAlerteLe && u.derniereAlerteLe > limite) {
      bilan.ignores++;
      continue;
    }
    const alertes = (await notificationsPour({ id: u.id, role: u.role as Role })).filter(
      (a) => a.niveau !== "info",
    );
    if (alertes.length === 0) {
      bilan.ignores++;
      continue;
    }
    const mail = composerResume(u.nom, alertes, options.urlApp ?? process.env.APP_URL ?? "");
    try {
      await transport.sendMail({ from: expediteur, to: u.email, subject: mail.sujet, text: mail.texte, html: mail.html });
      await prisma.user.update({ where: { id: u.id }, data: { derniereAlerteLe: maintenant } });
      bilan.envoyes++;
    } catch (e) {
      // On ne journalise que le message : jamais les identifiants SMTP.
      console.error("Envoi du résumé impossible :", e instanceof Error ? e.message : "erreur inconnue");
      bilan.erreurs++;
    }
  }
  return bilan;
}

export async function envoyerEmailTest(transport: Transport, expediteur: string, a: string, nom: string) {
  try {
    await transport.sendMail({
      from: expediteur,
      to: a,
      subject: `${MARQUE.nom} : email de test`,
      text: `Bonjour ${nom},\n\nL'envoi d'emails fonctionne. Vous recevrez ici le résumé quotidien de vos alertes.\n\n${MARQUE.nom} ${MARQUE.signature}`,
      html: `<p>Bonjour ${echapper(nom)},</p><p>L'envoi d'emails fonctionne. Vous recevrez ici le résumé quotidien de vos alertes.</p><p>${echapper(MARQUE.nom)} ${echapper(MARQUE.signature)}</p>`,
    });
  } catch (e) {
    console.error("Email de test impossible :", e instanceof Error ? e.message : "erreur inconnue");
    throw new ErreurMetier("L'envoi a échoué : vérifiez les paramètres SMTP (serveur, port, identifiant, mot de passe).");
  }
}

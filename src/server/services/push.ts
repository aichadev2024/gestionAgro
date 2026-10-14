import webpush from "web-push";
import { ErreurMetier } from "@/lib/erreurs";
import { MARQUE } from "@/lib/marque";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { notificationsPour } from "@/server/services/notifications";

export type Charge = { title: string; body: string; url?: string; tag?: string };
export type AbonnementPush = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Fonction qui envoie réellement la notification (web-push en production, un faux dans les tests). */
export type Envoyeur = (abonnement: AbonnementPush, contenu: string) => Promise<unknown>;

const MAX_APPAREILS = 5;
const DELAI_MINI_HEURES = 20;

/**
 * Seuls les services de notification des navigateurs sont acceptés : sinon un utilisateur pourrait
 * faire envoyer des requêtes du serveur vers n'importe quelle adresse.
 */
const HOTES_AUTORISES = [
  ".googleapis.com", // Chrome / Android (FCM)
  ".push.services.mozilla.com", // Firefox
  ".push.apple.com", // Safari / iOS
  ".notify.windows.com", // Edge / Windows
];

export function endpointAutorise(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && HOTES_AUTORISES.some((h) => url.hostname.endsWith(h));
  } catch {
    return false;
  }
}

export function pushConfigure(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function clePubliquePush(): string | null {
  return pushConfigure() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

/** Envoyeur réel basé sur les clés VAPID de l'environnement, ou null si les notifications push ne sont pas configurées. */
export function creerEnvoyeur(): Envoyeur | null {
  if (!pushConfigure()) return null;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  return (abonnement, contenu) => webpush.sendNotification(abonnement, contenu, { TTL: 24 * 3600, timeout: 8000 });
}

export async function enregistrerAbonnement(userId: string, abonnement: AbonnementPush) {
  const { endpoint, keys } = abonnement;
  if (!endpointAutorise(endpoint) || endpoint.length > 600) {
    throw new ErreurMetier("Ce navigateur n'est pas pris en charge pour les notifications.");
  }
  if (!keys?.p256dh || !keys?.auth || keys.p256dh.length > 200 || keys.auth.length > 100) {
    throw new ErreurMetier("Abonnement invalide.");
  }

  await prisma.$transaction(async (tx) => {
    // Le même appareil peut changer de compte : l'abonnement suit le dernier utilisateur connecté.
    await tx.abonnementPush.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
    // On garde les appareils les plus récents seulement.
    const tous = await tx.abonnementPush.findMany({
      where: { userId },
      orderBy: { creeLe: "desc" },
      select: { id: true },
    });
    const anciens = tous.slice(MAX_APPAREILS).map((a) => a.id);
    if (anciens.length > 0) await tx.abonnementPush.deleteMany({ where: { id: { in: anciens } } });
  });
}

export async function supprimerAbonnement(userId: string, endpoint: string) {
  await prisma.abonnementPush.deleteMany({ where: { userId, endpoint } });
}

export function nombreAppareils(userId: string) {
  return prisma.abonnementPush.count({ where: { userId } });
}

/** Envoie à tous les appareils de ces utilisateurs. Les abonnements expirés (404/410) sont supprimés. */
export async function pousserVersUtilisateurs(userIds: string[], charge: Charge, envoyeur: Envoyeur) {
  const bilan = { envoyes: 0, supprimes: 0, erreurs: 0 };
  if (userIds.length === 0) return bilan;
  const abonnements = await prisma.abonnementPush.findMany({ where: { userId: { in: userIds } } });
  const contenu = JSON.stringify({ ...charge, url: charge.url ?? "/notifications" });

  for (const a of abonnements) {
    try {
      await envoyeur({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, contenu);
      bilan.envoyes++;
    } catch (e) {
      const statut = (e as { statusCode?: number }).statusCode;
      if (statut === 404 || statut === 410) {
        await prisma.abonnementPush.delete({ where: { id: a.id } }).catch(() => undefined);
        bilan.supprimes++;
      } else {
        // On ne journalise jamais le contenu ni les clés de l'abonnement.
        console.error("Notification push non envoyée :", statut ?? "erreur réseau");
        bilan.erreurs++;
      }
    }
  }
  return bilan;
}

export async function pousserVersRoles(roles: Role[], charge: Charge, envoyeur: Envoyeur, exclureUserId?: string) {
  const users = await prisma.user.findMany({
    where: { actif: true, role: { in: roles }, ...(exclureUserId ? { id: { not: exclureUserId } } : {}) },
    select: { id: true },
  });
  return pousserVersUtilisateurs(users.map((u) => u.id), charge, envoyeur);
}

/**
 * Notification d'un événement en direct (stock bas, annulation, écart de caisse…).
 * Ne lève jamais d'erreur : une notification ratée ne doit jamais empêcher l'action de l'utilisateur.
 */
export async function notifierEvenement(
  roles: Role[],
  charge: Charge,
  options: { exclure?: string; envoyeur?: Envoyeur | null } = {},
) {
  try {
    const envoyeur = options.envoyeur === undefined ? creerEnvoyeur() : options.envoyeur;
    if (!envoyeur) return;
    await pousserVersRoles(roles, charge, envoyeur, options.exclure);
  } catch (e) {
    console.error("Notification d'événement impossible :", e instanceof Error ? e.message : "erreur inconnue");
  }
}

/** Résumé du matin : une notification par personne équipée, seulement s'il y a des alertes importantes. */
export async function envoyerResumesPush(
  envoyeur: Envoyeur,
  options: { maintenant?: Date; forcer?: boolean } = {},
) {
  const maintenant = options.maintenant ?? new Date();
  const limite = new Date(maintenant.getTime() - DELAI_MINI_HEURES * 3600 * 1000);
  const bilan = { envoyes: 0, ignores: 0, erreurs: 0 };

  const equipes = await prisma.user.findMany({
    where: { actif: true, abonnementsPush: { some: {} } },
    select: { id: true, role: true, dernierPushLe: true },
  });

  for (const u of equipes) {
    if (!options.forcer && u.dernierPushLe && u.dernierPushLe > limite) {
      bilan.ignores++;
      continue;
    }
    const alertes = (await notificationsPour({ id: u.id, role: u.role as Role })).filter((a) => a.niveau !== "info");
    if (alertes.length === 0) {
      bilan.ignores++;
      continue;
    }
    const urgent = alertes.some((a) => a.niveau === "critique");
    const resultat = await pousserVersUtilisateurs(
      [u.id],
      {
        title: `${MARQUE.nom} : ${alertes.length} alerte(s) à traiter${urgent ? " (urgent)" : ""}`,
        body: alertes.slice(0, 2).map((a) => a.titre).join(" · "),
        url: "/notifications",
        tag: "resume-quotidien",
      },
      envoyeur,
    );
    if (resultat.envoyes > 0) {
      await prisma.user.update({ where: { id: u.id }, data: { dernierPushLe: maintenant } });
      bilan.envoyes++;
    } else {
      bilan.erreurs += resultat.erreurs > 0 ? 1 : 0;
    }
  }
  return bilan;
}

/** Stock total (lots non périmés) de produits donnés, avec leur seuil d'alerte. */
export async function stocksTotaux(produitIds: string[]) {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const [produits, lots] = await Promise.all([
    prisma.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, nom: true, seuilAlerte: true, unite: { select: { symbole: true } } },
    }),
    prisma.lot.groupBy({
      by: ["produitId"],
      where: {
        produitId: { in: produitIds },
        quantiteRestante: { gt: 0 },
        OR: [{ datePeremption: null }, { datePeremption: { gte: aujourdhui } }],
      },
      _sum: { quantiteRestante: true },
    }),
  ]);
  const total = new Map(lots.map((l) => [l.produitId, l._sum.quantiteRestante?.toNumber() ?? 0]));
  return new Map(
    produits.map((p) => [
      p.id,
      { nom: p.nom, symbole: p.unite.symbole, seuil: p.seuilAlerte.toNumber(), total: total.get(p.id) ?? 0 },
    ]),
  );
}

type Stocks = Awaited<ReturnType<typeof stocksTotaux>>;

/** Produits qui viennent de passer sous leur seuil (et non ceux qui y étaient déjà : pas de répétition). */
export function passesEnStockBas(avant: Stocks, apres: Stocks) {
  const liste: { nom: string; symbole: string; total: number }[] = [];
  for (const [id, a] of apres) {
    const b = avant.get(id);
    if (b && a.seuil > 0 && b.total > a.seuil && a.total <= a.seuil) {
      liste.push({ nom: a.nom, symbole: a.symbole, total: a.total });
    }
  }
  return liste;
}

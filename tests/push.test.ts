import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  endpointAutorise,
  enregistrerAbonnement,
  envoyerResumesPush,
  notifierEvenement,
  nombreAppareils,
  passesEnStockBas,
  pousserVersRoles,
  pousserVersUtilisateurs,
  stocksTotaux,
  supprimerAbonnement,
  type Envoyeur,
} from "@/server/services/push";
import { base, dans, lot, produit } from "./helpers";

const FCM = "https://fcm.googleapis.com/fcm/send/";
const abonnement = (id: string, host = FCM) => ({
  endpoint: `${host}${id}`,
  keys: { p256dh: "cle-publique-" + id, auth: "auth-" + id },
});

describe("Sécurité des abonnements", () => {
  it("n'accepte que les vrais services de notification des navigateurs", () => {
    expect(endpointAutorise("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(endpointAutorise("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(endpointAutorise("https://web.push.apple.com/abc")).toBe(true);
    expect(endpointAutorise("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);

    expect(endpointAutorise("http://fcm.googleapis.com/x")).toBe(false); // pas https
    expect(endpointAutorise("https://localhost/x")).toBe(false);
    expect(endpointAutorise("https://169.254.169.254/latest/meta-data")).toBe(false); // métadonnées cloud
    expect(endpointAutorise("https://evil.example.com/x")).toBe(false);
    expect(endpointAutorise("https://fcm.googleapis.com.evil.com/x")).toBe(false); // faux sous-domaine
    expect(endpointAutorise("pas une adresse")).toBe(false);
  });

  it("refuse un abonnement vers une adresse non autorisée ou incomplet", async () => {
    const c = await base();
    await expect(
      enregistrerAbonnement(c.users.GERANT, abonnement("a", "https://evil.example.com/")),
    ).rejects.toThrow(/pas pris en charge/);
    await expect(
      enregistrerAbonnement(c.users.GERANT, { endpoint: FCM + "a", keys: { p256dh: "", auth: "x" } }),
    ).rejects.toThrow(/invalide/);
    expect(await nombreAppareils(c.users.GERANT)).toBe(0);
  });

  it("garde au plus 5 appareils par utilisateur et laisse un appareil changer de compte", async () => {
    const c = await base();
    for (let i = 1; i <= 7; i++) {
      await enregistrerAbonnement(c.users.GERANT, abonnement(String(i)));
      await new Promise((r) => setTimeout(r, 5)); // dates de création distinctes
    }
    expect(await nombreAppareils(c.users.GERANT)).toBe(5);
    const restants = (await prisma.abonnementPush.findMany({ where: { userId: c.users.GERANT } })).map((a) => a.endpoint);
    expect(restants).not.toContain(FCM + "1"); // les plus anciens sont partis
    expect(restants).toContain(FCM + "7");

    // même appareil, autre compte : il suit le dernier utilisateur connecté (pas de doublon)
    await enregistrerAbonnement(c.users.CAISSIER, abonnement("7"));
    expect(await prisma.abonnementPush.count({ where: { endpoint: FCM + "7" } })).toBe(1);
    expect(await nombreAppareils(c.users.CAISSIER)).toBe(1);

    // un utilisateur ne peut pas supprimer l'appareil d'un autre
    await supprimerAbonnement(c.users.GERANT, FCM + "7");
    expect(await nombreAppareils(c.users.CAISSIER)).toBe(1);
    await supprimerAbonnement(c.users.CAISSIER, FCM + "7");
    expect(await nombreAppareils(c.users.CAISSIER)).toBe(0);
  });
});

describe("Envoi", () => {
  it("envoie à tous les appareils, supprime les abonnements expirés et garde ceux en erreur temporaire", async () => {
    const c = await base();
    for (const id of ["ok", "expire", "panne"]) await enregistrerAbonnement(c.users.GERANT, abonnement(id));

    const envoyeur: Envoyeur = vi.fn(async (a) => {
      if (a.endpoint.endsWith("expire")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (a.endpoint.endsWith("panne")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    const bilan = await pousserVersUtilisateurs([c.users.GERANT], { title: "Titre", body: "Corps" }, envoyeur);

    expect(bilan).toEqual({ envoyes: 1, supprimes: 1, erreurs: 1 });
    expect(await nombreAppareils(c.users.GERANT)).toBe(2); // « expire » supprimé, « panne » conservé
    const [, contenu] = vi.mocked(envoyeur).mock.calls[0];
    expect(JSON.parse(contenu)).toEqual({ title: "Titre", body: "Corps", url: "/notifications" });
  });

  it("cible un rôle, sans l'auteur de l'action ni les comptes désactivés", async () => {
    const c = await base();
    const autre = await prisma.user.create({ data: { nom: "G2", email: "g2@test.local", role: "GERANT", motDePasse: "x" } });
    const inactif = await prisma.user.create({ data: { nom: "G3", email: "g3@test.local", role: "GERANT", motDePasse: "x", actif: false } });
    for (const id of [c.users.GERANT, autre.id, inactif.id, c.users.CAISSIER]) {
      await enregistrerAbonnement(id, abonnement(id));
    }
    const envoyeur = vi.fn<Envoyeur>(async () => undefined);
    await pousserVersRoles(["GERANT"], { title: "t", body: "b" }, envoyeur, c.users.GERANT);

    expect(envoyeur).toHaveBeenCalledTimes(1);
    expect(vi.mocked(envoyeur).mock.calls[0][0].endpoint).toBe(FCM + autre.id);
  });

  it("ne lève jamais d'erreur pour un événement, même si l'envoi échoue", async () => {
    const c = await base();
    await enregistrerAbonnement(c.users.GERANT, abonnement("a"));
    const casse: Envoyeur = async () => {
      throw new Error("réseau coupé");
    };
    await expect(notifierEvenement(["GERANT"], { title: "t", body: "b" }, { envoyeur: casse })).resolves.toBeUndefined();
    await expect(notifierEvenement(["GERANT"], { title: "t", body: "b" }, { envoyeur: null })).resolves.toBeUndefined();
  });
});

describe("Résumé du matin par push", () => {
  async function alerte(c: Awaited<ReturnType<typeof base>>) {
    const p = await produit(c, "P1");
    await lot(c, p.id, "L1", 5, { peremption: dans(-3) }); // lot périmé : alerte urgente
  }

  it("n'écrit qu'aux personnes équipées qui ont une alerte importante, une fois par jour", async () => {
    const c = await base();
    await alerte(c);
    await enregistrerAbonnement(c.users.GERANT, abonnement("g"));
    await enregistrerAbonnement(c.users.CAISSIER, abonnement("c")); // le caissier n'a aucune alerte
    const envoyeur = vi.fn<Envoyeur>(async () => undefined);

    expect(await envoyerResumesPush(envoyeur)).toEqual({ envoyes: 1, ignores: 1, erreurs: 0 });
    const [a, contenu] = envoyeur.mock.calls[0];
    expect(a.endpoint).toBe(FCM + "g");
    expect(JSON.parse(contenu).title).toContain("urgent");

    expect((await envoyerResumesPush(envoyeur)).envoyes).toBe(0); // déjà fait aujourd'hui
    expect((await envoyerResumesPush(envoyeur, { forcer: true })).envoyes).toBe(1);
  });

  it("ne marque pas le résumé comme envoyé si aucun appareil n'a pu le recevoir", async () => {
    const c = await base();
    await alerte(c);
    await enregistrerAbonnement(c.users.GERANT, abonnement("g"));
    const casse: Envoyeur = async () => {
      throw Object.assign(new Error("boom"), { statusCode: 503 });
    };
    const bilan = await envoyerResumesPush(casse);
    expect(bilan.envoyes).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.users.GERANT } })).dernierPushLe).toBeNull();
  });
});

describe("Alerte de stock bas en direct", () => {
  it("ne se déclenche qu'au moment où le seuil est franchi, pas à chaque vente suivante", async () => {
    const c = await base();
    const p = await produit(c, "P1", { seuilAlerte: 10 });
    const sansSeuil = await produit(c, "P2", { seuilAlerte: 0 });
    const l = await lot(c, p.id, "L1", 12);
    await lot(c, sansSeuil.id, "L2", 12);
    const ids = [p.id, sansSeuil.id];
    const retirer = (q: number) =>
      prisma.lot.update({ where: { id: l.id }, data: { quantiteRestante: { decrement: q } } });

    const avant = await stocksTotaux(ids);
    await retirer(4); // 12 → 8, sous le seuil de 10
    const apres = await stocksTotaux(ids);
    expect(passesEnStockBas(avant, apres).map((x) => x.nom)).toEqual([p.nom]);
    expect(passesEnStockBas(avant, apres)[0].total).toBe(8);

    await retirer(3); // 8 → 5 : déjà bas, pas de nouvelle alerte
    expect(passesEnStockBas(apres, await stocksTotaux(ids))).toEqual([]);
    expect(passesEnStockBas(avant, avant)).toEqual([]);
  });
});

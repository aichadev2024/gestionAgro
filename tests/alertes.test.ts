import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lienWhatsApp } from "@/lib/whatsapp";
import { GET as cronGet } from "@/app/api/cron/alertes/route";
import { composerResume, envoyerResumes, type Transport } from "@/server/services/alertes-email";
import { base, dans, lot, produit } from "./helpers";

type Mail = Parameters<Transport["sendMail"]>[0];
const fauxTransport = (echec = false) => {
  const envoyes: Mail[] = [];
  const transport: Transport = {
    async sendMail(mail) {
      if (echec) throw new Error("connexion refusée");
      envoyes.push(mail);
    },
  };
  return { transport, envoyes };
};

/** Un lot périmé = une alerte « urgente » pour les gérants et magasiniers. */
async function creerAlerte(c: Awaited<ReturnType<typeof base>>, nom = "Riz") {
  const p = await produit(c, "P1");
  await prisma.produit.update({ where: { id: p.id }, data: { nom } });
  await lot(c, p.id, "L1", 5, { peremption: dans(-3) });
}

describe("Liens WhatsApp", () => {
  it("ajoute l'indicatif aux numéros locaux et nettoie la saisie", () => {
    expect(lienWhatsApp("70 12 34 56", "Bonjour")).toBe("https://wa.me/22370123456?text=Bonjour");
    expect(lienWhatsApp("+223 70-12-34-56", "x")).toContain("wa.me/22370123456");
    expect(lienWhatsApp("00221771234567", "x")).toContain("wa.me/221771234567");
  });

  it("encode le message et refuse les numéros absents ou inutilisables", () => {
    expect(lienWhatsApp("70123456", "Solde : 5 000 FCFA & merci")).toContain(
      "text=Solde%20%3A%205%20000%20FCFA%20%26%20merci",
    );
    expect(lienWhatsApp(null, "x")).toBeNull();
    expect(lienWhatsApp("", "x")).toBeNull();
    expect(lienWhatsApp("abc", "x")).toBeNull();
    expect(lienWhatsApp("12", "x")).toBeNull(); // trop court même avec l'indicatif
  });
});

describe("Résumé quotidien par email", () => {
  it("n'écrit qu'aux personnes qui l'ont activé et qui ont une alerte importante", async () => {
    const c = await base();
    await creerAlerte(c);
    await prisma.user.update({ where: { id: c.users.GERANT }, data: { recoitAlertes: true } });
    await prisma.user.update({ where: { id: c.users.CAISSIER }, data: { recoitAlertes: true } }); // aucune alerte pour lui
    // MAGASINIER a des alertes mais n'a pas activé le résumé

    const { transport, envoyes } = fauxTransport();
    const bilan = await envoyerResumes(transport, "Sahelia <x@y.z>");

    expect(bilan).toEqual({ envoyes: 1, ignores: 1, erreurs: 0 });
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].to).toBe("gerant@test.local");
    expect(envoyes[0].subject).toContain("alerte");
    expect(envoyes[0].text).toContain("périmé");
  });

  it("n'envoie au plus qu'un résumé par jour, sauf demande explicite", async () => {
    const c = await base();
    await creerAlerte(c);
    await prisma.user.update({ where: { id: c.users.GERANT }, data: { recoitAlertes: true } });
    const { transport, envoyes } = fauxTransport();

    expect((await envoyerResumes(transport, "a@b.c")).envoyes).toBe(1);
    expect((await envoyerResumes(transport, "a@b.c")).envoyes).toBe(0);
    expect(envoyes).toHaveLength(1);

    const demain = new Date(Date.now() + 25 * 3600 * 1000);
    expect((await envoyerResumes(transport, "a@b.c", { maintenant: demain })).envoyes).toBe(1);
    expect((await envoyerResumes(transport, "a@b.c", { forcer: true })).envoyes).toBe(1);
  });

  it("ne marque pas l'envoi comme fait si le serveur d'email échoue, et continue pour les autres", async () => {
    const c = await base();
    await creerAlerte(c);
    await prisma.user.update({ where: { id: c.users.GERANT }, data: { recoitAlertes: true } });
    const { transport } = fauxTransport(true);

    const bilan = await envoyerResumes(transport, "a@b.c");
    expect(bilan.erreurs).toBe(1);
    expect(bilan.envoyes).toBe(0);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: c.users.GERANT } });
    expect(u.derniereAlerteLe).toBeNull(); // il pourra être réessayé
  });

  it("ignore les comptes désactivés", async () => {
    const c = await base();
    await creerAlerte(c);
    await prisma.user.update({ where: { id: c.users.GERANT }, data: { recoitAlertes: true, actif: false } });
    const { transport, envoyes } = fauxTransport();
    await envoyerResumes(transport, "a@b.c");
    expect(envoyes).toHaveLength(0);
  });

  it("neutralise le HTML venant des données (nom de produit piégé)", () => {
    const { html, texte } = composerResume(
      "Aïcha <script>",
      [
        {
          id: "x", niveau: "critique", categorie: "Stock",
          titre: "Lot de <img src=x onerror=alert(1)>",
          detail: "\"guillemets\" & <b>gras</b>", href: "/stocks",
        },
      ],
      "https://sahelia.exemple",
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>gras</b>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("https://sahelia.exemple/notifications");
    expect(texte).toContain("Ouvrir l'application");
  });
});

describe("Route planifiée /api/cron/alertes", () => {
  const ancien = { ...process.env };
  afterEach(() => {
    process.env = { ...ancien };
  });
  const appel = (jeton?: string) =>
    cronGet(new Request("http://localhost/api/cron/alertes", { headers: jeton ? { authorization: `Bearer ${jeton}` } : {} }));

  it("reste fermée tant que CRON_SECRET n'est pas configuré", async () => {
    delete process.env.CRON_SECRET;
    expect((await appel("n-importe-quoi-assez-long")).status).toBe(503);
    process.env.CRON_SECRET = "trop-court";
    expect((await appel("trop-court")).status).toBe(503);
  });

  it("refuse un mauvais jeton ou son absence", async () => {
    process.env.CRON_SECRET = "un-secret-assez-long-123";
    expect((await appel()).status).toBe(401);
    expect((await appel("un-secret-assez-long-124")).status).toBe(401);
    expect((await appel("court")).status).toBe(401);
  });

  it("accepte le bon jeton et prévient si l'email n'est pas configuré", async () => {
    process.env.CRON_SECRET = "un-secret-assez-long-123";
    delete process.env.SMTP_HOST;
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await appel("un-secret-assez-long-123");
    expect(res.status).toBe(200);
    const corps = await res.json();
    expect(corps.envoyes).toBe(0);
    expect(corps.email.raison).toContain("SMTP");
    expect(corps.push.raison).toContain("VAPID");
  });
});

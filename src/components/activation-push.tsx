"use client";

import { useEffect, useState, useTransition } from "react";
import { abonnerPush, desabonnerPush, envoyerPushTest } from "@/server/actions/push";

/** Convertit la clé publique VAPID (base64 URL) au format attendu par le navigateur. */
function versUint8Array(cleBase64: string) {
  const remplissage = "=".repeat((4 - (cleBase64.length % 4)) % 4);
  const base64 = (cleBase64 + remplissage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

type Etat = "chargement" | "non-supporte" | "refuse" | "inactif" | "actif";

export function ActivationPush({ clePublique }: { clePublique: string | null }) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [message, setMessage] = useState<{ texte: string; ok: boolean }>();
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let annule = false;
    (async () => {
      const supporte = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supporte) return !annule && setEtat("non-supporte");
      if (Notification.permission === "denied") return !annule && setEtat("refuse");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const abonnement = await reg?.pushManager.getSubscription();
      if (!annule) setEtat(abonnement ? "actif" : "inactif");
    })().catch(() => !annule && setEtat("non-supporte"));
    return () => {
      annule = true;
    };
  }, []);

  if (!clePublique) {
    return (
      <p className="text-sm text-gray-500">
        Les notifications push ne sont pas encore configurées sur le serveur (clés VAPID). Voir DEPLOIEMENT.md.
      </p>
    );
  }

  const activer = () =>
    demarrer(async () => {
      setMessage(undefined);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setEtat(permission === "denied" ? "refuse" : "inactif");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const abonnement =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: versUint8Array(clePublique),
          }));
        const json = abonnement.toJSON();
        const res = await abonnerPush({
          endpoint: abonnement.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        });
        if (res?.erreur) {
          await abonnement.unsubscribe().catch(() => undefined);
          setMessage({ texte: res.erreur, ok: false });
          return;
        }
        setEtat("actif");
        setMessage({ texte: "Notifications activées sur cet appareil.", ok: true });
      } catch {
        setMessage({ texte: "Impossible d'activer les notifications sur cet appareil.", ok: false });
      }
    });

  const desactiver = () =>
    demarrer(async () => {
      setMessage(undefined);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const abonnement = await reg?.pushManager.getSubscription();
      if (abonnement) {
        await desabonnerPush(abonnement.endpoint);
        await abonnement.unsubscribe().catch(() => undefined);
      }
      setEtat("inactif");
      setMessage({ texte: "Notifications désactivées sur cet appareil.", ok: true });
    });

  const tester = () =>
    demarrer(async () => {
      const res = await envoyerPushTest();
      setMessage(
        res?.erreur ? { texte: res.erreur, ok: false } : { texte: "Notification de test envoyée.", ok: true },
      );
    });

  return (
    <div className="space-y-3">
      {etat === "chargement" && <p className="text-sm text-gray-400">Vérification…</p>}
      {etat === "non-supporte" && (
        <p className="text-sm text-gray-500">
          Ce navigateur ne prend pas en charge les notifications push. Sur iPhone, ajoutez d&apos;abord
          l&apos;application à l&apos;écran d&apos;accueil (Partager → Sur l&apos;écran d&apos;accueil), puis
          ouvrez-la depuis l&apos;icône.
        </p>
      )}
      {etat === "refuse" && (
        <p className="text-sm text-tomate">
          Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur
          (icône de cadenas à côté de l&apos;adresse), puis rechargez la page.
        </p>
      )}
      {etat === "inactif" && (
        <button
          onClick={activer}
          disabled={enCours}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {enCours ? "Activation…" : "Activer les notifications sur cet appareil"}
        </button>
      )}
      {etat === "actif" && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={tester}
            disabled={enCours}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Envoyer une notification de test
          </button>
          <button
            onClick={desactiver}
            disabled={enCours}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Désactiver sur cet appareil
          </button>
        </div>
      )}
      {message && <p className={`text-sm ${message.ok ? "text-brand" : "text-tomate"}`}>{message.texte}</p>}
    </div>
  );
}

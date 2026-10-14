import { MARQUE } from "@/lib/marque";

/**
 * Lien « cliquer pour discuter » WhatsApp : ouvre WhatsApp avec le message déjà écrit,
 * il ne reste qu'à appuyer sur Envoyer. Aucun compte professionnel ni API payante nécessaire.
 * Renvoie null si le numéro est absent ou inutilisable.
 */
export function lienWhatsApp(telephone: string | null | undefined, message: string): string | null {
  if (!telephone) return null;
  let numero = telephone.replace(/\D/g, "");
  if (numero.startsWith("00")) numero = numero.slice(2);
  // Numéro local (sans indicatif) : on ajoute l'indicatif du pays configuré.
  if (numero.length > 0 && numero.length <= 8) numero = MARQUE.indicatifPays + numero;
  if (numero.length < 8) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

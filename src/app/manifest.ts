import type { MetadataRoute } from "next";
import { MARQUE } from "@/lib/marque";

// Rend l'application installable sur téléphone et tablette (« Ajouter à l'écran d'accueil »).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${MARQUE.nom} · ${MARQUE.slogan}`,
    short_name: MARQUE.nom,
    description: "Stocks, achats, ventes et production de votre entreprise agroalimentaire",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ec",
    theme_color: "#1f5d34",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

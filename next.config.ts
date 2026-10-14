import type { NextConfig } from "next";

const entetesSecurite = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Force HTTPS pendant 1 an (ignoré en http local).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Ces paquets lisent des fichiers à l'exécution : on évite de les empaqueter.
  serverExternalPackages: ["exceljs", "pdf-lib", "bcryptjs", "pg"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: entetesSecurite },
      {
        // Le navigateur doit toujours récupérer la dernière version du service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

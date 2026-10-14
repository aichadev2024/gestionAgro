import { MARQUE } from "@/lib/marque";

/** Pictogramme : un épi de blé devant un soleil levant, sur un carreau vert forêt. */
export function Pictogramme({ taille = 44, fond = true }: { taille?: number; fond?: boolean }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 64 64"
      role="img"
      aria-label={MARQUE.nom}
      xmlns="http://www.w3.org/2000/svg"
    >
      {fond && <rect width="64" height="64" rx="16" fill="#1f5d34" />}
      {/* soleil levant */}
      <path d="M13 49a19 19 0 0 1 38 0z" fill="#f08a24" />
      <path d="M8 49h48" stroke="#faf6ec" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      {/* épi de blé */}
      <g fill="#faf6ec">
        <path d="M31 56c0-14 0-26 1-39h0c1 13 1 25 1 39z" />
        <ellipse cx="32" cy="12.5" rx="3" ry="6" />
        <g transform="translate(26.2 22) rotate(-32)"><ellipse rx="3" ry="6.2" /></g>
        <g transform="translate(37.8 22) rotate(32)"><ellipse rx="3" ry="6.2" /></g>
        <g transform="translate(26 31.5) rotate(-32)"><ellipse rx="3" ry="6.2" /></g>
        <g transform="translate(38 31.5) rotate(32)"><ellipse rx="3" ry="6.2" /></g>
        <g transform="translate(26.4 41) rotate(-32)"><ellipse rx="3" ry="6.2" /></g>
        <g transform="translate(37.6 41) rotate(32)"><ellipse rx="3" ry="6.2" /></g>
      </g>
    </svg>
  );
}

/** Logo complet : pictogramme + nom. `sombre` pour un fond foncé (en-tête), `clair` pour un fond clair. */
export function Logo({
  variante = "sombre",
  taille = 44,
  sousTitre = true,
}: {
  variante?: "sombre" | "clair";
  taille?: number;
  sousTitre?: boolean;
}) {
  const sombre = variante === "sombre";
  return (
    <div className="flex items-center gap-3">
      <Pictogramme taille={taille} fond={!sombre} />
      <div className="leading-tight">
        <div
          className={`font-extrabold tracking-[0.18em] ${sombre ? "text-white" : "text-brand"}`}
          style={{ fontSize: taille * 0.5 }}
        >
          {MARQUE.nom.toUpperCase()}
        </div>
        {sousTitre && (
          <div
            className="font-bold uppercase tracking-[0.22em] text-accent"
            style={{ fontSize: Math.max(taille * 0.2, 9) }}
          >
            {MARQUE.slogan}
          </div>
        )}
      </div>
    </div>
  );
}

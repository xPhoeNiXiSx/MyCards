/**
 * La marque : silhouette de carte et liseré intérieur évidé.
 * Le tracé est identique à `app/icon.svg`, qui sert de favicon. Les
 * proportions reprennent celles d'une vraie carte, 63 x 88 mm.
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M18 4 h28 a6 6 0 0 1 6 6 v44 a6 6 0 0 1 -6 6 h-28 a6 6 0 0 1 -6 -6 v-44 a6 6 0 0 1 6 -6 z M20.5 11 h23 a3.5 3.5 0 0 1 3.5 3.5 v35 a3.5 3.5 0 0 1 -3.5 3.5 h-23 a3.5 3.5 0 0 1 -3.5 -3.5 v-35 a3.5 3.5 0 0 1 3.5 -3.5 z M23 14.5 h18 a2.5 2.5 0 0 1 2.5 2.5 v30 a2.5 2.5 0 0 1 -2.5 2.5 h-18 a2.5 2.5 0 0 1 -2.5 -2.5 v-30 a2.5 2.5 0 0 1 2.5 -2.5 z"
      />
    </svg>
  );
}

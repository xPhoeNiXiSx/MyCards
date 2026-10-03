import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";

import "./globals.css";

import { Wordmark } from "./wordmark";

/**
 * Une seule famille, Outfit, pour le texte comme pour les montants : ronde
 * et géométrique, dans l'esprit des interfaces de jeu de cartes. Les montants
 * prennent ses graisses fortes. Deux variables restent exposées pour que le
 * CSS puisse un jour séparer les rôles sans toucher aux composants.
 */
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyCards",
  description: "Ma collection Pokémon : catalogue, inventaire et valeur.",
  // Ce que iOS lit quand l'application est posée sur l'écran d'accueil.
  appleWebApp: {
    capable: true,
    title: "MyCards",
    statusBarStyle: "default",
  },
  // Next émet la balise standardisée `mobile-web-app-capable`. Les versions
  // d'iOS antérieures à 16.4 ne lisent que la variante préfixée : sans elle,
  // le raccourci rouvre le site dans Safari, barre d'adresse comprise.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0f1f",
  // Laisse la page occuper toute la dalle ; les encoches sont absorbées par
  // les `env(safe-area-inset-*)` du CSS.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>
        {/* Écran de démarrage : le logo et une barre irisée, le temps que la
            page s'installe, puis il s'efface de lui-même — en CSS seul, il ne
            dépend d'aucun script. Posé dans la mise en page commune, il ne se
            joue qu'à l'ouverture de l'application, pas à chaque changement
            d'onglet. */}
        <div className="splash" aria-hidden="true">
          <Wordmark className="splash-logo" />
          <span className="splash-bar" />
        </div>
        {children}
      </body>
    </html>
  );
}

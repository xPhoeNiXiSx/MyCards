import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import "./globals.css";

/** Texte courant : taillé pour les petites tailles d'interface. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Titres et montants. Ses chiffres ont assez de caractère pour porter les
 * valeurs de la collection, qui sont le cœur de l'application.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
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
  themeColor: "#131210",
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
    <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}

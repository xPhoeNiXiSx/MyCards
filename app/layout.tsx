import type { Metadata } from "next";
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
  title: "MyCards — Célébration 30 ans",
  description:
    "La collection anniversaire des 30 ans du JCC Pokémon, et le suivi de ma collection.",
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

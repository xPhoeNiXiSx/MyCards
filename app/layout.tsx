import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "MyCards — Célébration 30 ans",
  description:
    "La collection anniversaire des 30 ans du JCC Pokémon, en français.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

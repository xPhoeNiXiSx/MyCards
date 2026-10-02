import Link from "next/link";

import { ChevronBack } from "./chevron-back";

/**
 * En-tête d'un écran de second niveau (la fiche d'un article) : un bouton
 * retour bien visible à la place du logo. Un niveau sous la barre d'onglets,
 * c'est le chemin du retour qui compte, pas la marque.
 */
export function BackBar({ href, label }: { href: string; label: string }) {
  return (
    <header className="backbar">
      <Link href={href} className="back-btn">
        <ChevronBack />
        <span>{label}</span>
      </Link>
    </header>
  );
}

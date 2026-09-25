import { formatSignedCents } from "@/lib/money";

/**
 * Une plus-value, précédée d'une flèche : ▲ en hausse, ▼ en baisse, rien à
 * zéro. La couleur seule ne suffit pas à lire le sens (daltonisme, écran en
 * plein soleil) ; la flèche le dit sans elle. Elle est décorative pour les
 * lecteurs d'écran, le signe du montant portant déjà l'information.
 */
export function Gain({ cents }: { cents: number }) {
  return (
    <>
      {cents === 0 ? null : (
        <span className="trend" aria-hidden="true">
          {cents > 0 ? "▲" : "▼"}
        </span>
      )}
      {formatSignedCents(cents)}
    </>
  );
}

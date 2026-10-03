/**
 * Indicateur de chargement : un anneau au dégradé holo qui tourne. Décoratif
 * pour les lecteurs d'écran — le libellé du bouton, lui, dit ce qui se passe
 * (« Enregistrement… »).
 */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

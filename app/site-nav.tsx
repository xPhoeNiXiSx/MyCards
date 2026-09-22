"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutAction } from "./login/actions";

type Props = {
  /** Affiche la déconnexion. Passé par les pages qui savent la session ouverte. */
  authenticated?: boolean;
};

const LINKS = [
  { href: "/", label: "Collection 30 ans", hint: "La galerie complète du set" },
  { href: "/collection", label: "Mon inventaire", hint: "Ce que je possède et sa valeur" },
];

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      {open ? (
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="3.5" y1="6" x2="16.5" y2="6" />
          <line x1="3.5" y1="10" x2="16.5" y2="10" />
          <line x1="3.5" y1="14" x2="16.5" y2="14" />
        </g>
      )}
    </svg>
  );
}

export function SiteNav({ authenticated = false }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Naviguer referme le menu : sans ça il resterait ouvert sur la page suivante.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="site-nav" aria-label="Navigation principale">
      {open ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="nav-sheet" id="nav-sheet" hidden={!open}>
        <ul>
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "active" : undefined}
                >
                  <span className="nav-label">{link.label}</span>
                  <span className="nav-hint">{link.hint}</span>
                </Link>
              </li>
            );
          })}

          {authenticated ? (
            <li>
              <form action={logoutAction}>
                <button type="submit" className="nav-logout">
                  Se déconnecter
                </button>
              </form>
            </li>
          ) : null}
        </ul>
      </div>

      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="nav-sheet"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <BurgerIcon open={open} />
      </button>
    </nav>
  );
}

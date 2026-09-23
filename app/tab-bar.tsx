"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barre d'onglets fixée en bas, à la manière d'une application mobile.
 * Icônes seules : chaque onglet porte donc un `aria-label` et un `title`, sans
 * quoi la destination ne serait lisible ni au lecteur d'écran ni au survol.
 */

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Vrai si le chemin courant appartient à cet onglet. */
  matches: (pathname: string) => boolean;
};

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.6 10.4 12 3.8l8.4 6.6" />
        <path d="M5.6 12v8.2h12.8V12" />
        <path d="M10 20.2v-5.4h4v5.4" />
      </g>
    </svg>
  );
}

function IconCollection() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </g>
    </svg>
  );
}

/** Deux cartes décalées : la collection de cartes. */
function IconCards() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="8.5" y="3.5" width="10" height="14" rx="1.8" transform="rotate(8 13.5 10.5)" />
        <path d="M6.6 6.4 5.1 6.6a1.8 1.8 0 0 0-1.5 2l1.5 10.5a1.8 1.8 0 0 0 2 1.5l6.3-.9" />
      </g>
    </svg>
  );
}

/** Une boîte fermée : l'inventaire scellé. */
function IconSealed() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.8 7.6 12 3.8l8.2 3.8v8.8L12 20.2l-8.2-3.8Z" />
        <path d="M3.8 7.6 12 11.4l8.2-3.8" />
        <path d="M12 11.4v8.8" />
      </g>
    </svg>
  );
}

function IconWanted() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.2 4.5h11.6l-1.3 15a1.6 1.6 0 0 1-1.6 1.4H9.1a1.6 1.6 0 0 1-1.6-1.4Z" />
        <path d="M9 7.6V6.1a3 3 0 0 1 6 0v1.5" />
      </g>
    </svg>
  );
}

function IconAccount() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8.5" r="3.75" />
        <path d="M4.5 20.2c1.6-3.6 4.3-5.4 7.5-5.4s5.9 1.8 7.5 5.4" />
      </g>
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: <IconHome />,
    matches: (pathname) => pathname === "/",
  },
  {
    href: "/catalogue",
    label: "Catalogue",
    icon: <IconCollection />,
    matches: (pathname) => pathname.startsWith("/catalogue"),
  },
  {
    // La fiche d'un article (`/collection/[id]`) s'ouvre sous cet onglet,
    // qu'il s'agisse d'une carte ou d'un scellé.
    href: "/collection",
    label: "Ma collection de cartes",
    icon: <IconCards />,
    matches: (pathname) => pathname.startsWith("/collection"),
  },
  {
    href: "/scelle",
    label: "Mon inventaire scellé",
    icon: <IconSealed />,
    matches: (pathname) => pathname.startsWith("/scelle"),
  },
  {
    href: "/liste",
    label: "Ma liste",
    icon: <IconWanted />,
    matches: (pathname) => pathname.startsWith("/liste"),
  },
  {
    href: "/compte",
    label: "Mon compte",
    icon: <IconAccount />,
    matches: (pathname) => pathname.startsWith("/compte"),
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <ul>
        {TABS.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={tab.label}
                title={tab.label}
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
              >
                {tab.icon}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

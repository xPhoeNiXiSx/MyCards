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

function IconInventory() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="4.5" width="4" height="4" rx="1.2" />
        <rect x="3.5" y="15.5" width="4" height="4" rx="1.2" />
        <line x1="10.5" y1="6.5" x2="20.5" y2="6.5" />
        <line x1="10.5" y1="12" x2="20.5" y2="12" />
        <line x1="10.5" y1="17.5" x2="20.5" y2="17.5" />
        <rect x="3.5" y="10" width="4" height="4" rx="1.2" />
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
    href: "/collection",
    label: "Mon inventaire",
    icon: <IconInventory />,
    matches: (pathname) => pathname.startsWith("/collection"),
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

import type { QueryRunner } from "@/lib/db";

/**
 * Mise à jour automatique des cotes du scellé, depuis le bouton du compte.
 *
 * Elle suit la méthode de `docs/releves-de-cotes.md`, sur le même panel de
 * sources : la médiane des revendeurs qui ont le produit en stock, sinon le
 * plus bas prix Cardmarket. Les adresses ci-dessous sont celles du tableau
 * « Adresses par produit » de ce fichier : l'un ne change pas sans l'autre.
 *
 * Mêmes garde-fous que les migrations de données : seules les cotes vides ou
 * posées par un relevé (`value_source = 'auto'`) sont touchées, jamais une
 * cote saisie dans l'application.
 */

export type SealedSource = {
  url: string;
  /** Revendeur : prix public. Marché : Cardmarket, en dernier recours. */
  kind: "retail" | "market";
};

export type SealedProduct = {
  label: string;
  /**
   * Le nom vient d'une saisie au clavier : on le reconnaît à deux motifs
   * (l'objet et l'extension), comme `fillByPattern`, plutôt qu'à l'égalité.
   * Expressions communes à JavaScript et à Postgres, sur le nom en minuscules.
   */
  object: string;
  marker: string;
  /** Ce qui ferait d'un article un autre produit (un display n'est pas un booster). */
  exclude?: string;
  sources: SealedSource[];
};

const retail = (url: string): SealedSource => ({ url, kind: "retail" });
const market = (url: string): SealedSource => ({ url, kind: "market" });

/** Fin d'un numéro d'extension : « me01 » ne doit pas attraper « me010 ». */
const END = "([^0-9]|$)";
const NOT_A_SINGLE_BOOSTER = "display|bundle|blister|tripack|coffret|etb|lot";

export const SEALED_PRODUCTS: SealedProduct[] = [
  {
    label: "ETB 30 ans",
    object: "etb|dresseur|elite trainer",
    marker: "30",
    exclude: "pokemon center|pokémon center",
    sources: [
      market(
        "https://www.cardmarket.com/fr/Pokemon/Products/Elite-Trainer-Boxes/30th-Celebration-Elite-Trainer-Box?language=2",
      ),
    ],
  },
  {
    label: "Coffret Mewtwo Ex de la Team Rocket",
    object: "coffret",
    marker: "mewtwo",
    sources: [
      retail(
        "https://www.pokezenith.com/coffrets-boites-speciales/73-pokemon-coffret-mewtwo-ex-de-la-team-rocket-0196214109391.html",
      ),
    ],
  },
  {
    label: "Coffret Méga-Kangourex Ex",
    object: "coffret",
    marker: "kangourex",
    sources: [
      retail(
        "https://www.pokezenith.com/coffrets-boites-speciales/259-pokemon-coffret-mega-kangourex-ex-0196214116870.html",
      ),
      retail(
        "https://chocobonplan.com/bons-plans/cartes-a-jouer/cartes-pokemon/coffret-mega-kangourex-ex",
      ),
    ],
  },
  {
    label: "Tripack ME01",
    object: "tripack|tri-pack",
    marker: `me ?0?1${END}`,
    sources: [retail("https://www.blazingtail.fr/69068-tripack-pokemon-mega-evolution-me01.html")],
  },
  {
    label: "Tripack ME05 Nuit noire",
    object: "tripack|tri-pack",
    marker: `nuit|me ?0?5${END}`,
    sources: [
      retail("https://www.blazingtail.fr/80477-tripack-pokemon-nuit-noire-me05.html"),
      retail(
        "https://lesgentlemendujeu.com/pokemon-me05-nuit-noire/12348-pokemon-me05-tripack-nuit-noire-0196214142411.html",
      ),
    ],
  },
  {
    label: "Bundle Nuit Noire",
    object: "bundle",
    marker: `nuit|me ?0?5${END}`,
    sources: [
      retail(
        "https://lesgentlemendujeu.com/pokemon-me05-nuit-noire/12347-pokemon-me05-bundle-6-boosters-nuit-noire.html",
      ),
      retail("https://www.pokelite.fr/produit/bundle-nuit-noire-pokemon-me05/"),
      retail("https://www.cultura.com/p-bundle-pokemon-mega-evolutions-nuit-noire-13040385.html"),
    ],
  },
  {
    label: "Blister ME01",
    object: "blister",
    marker: `me ?0?1${END}`,
    sources: [
      retail("https://pokestock.fr/produit/booster-blister-me01-pokemon/"),
      retail("https://www.hamacards.com/produit/blister-pokemon-mega-evolution-me01/"),
    ],
  },
  {
    label: "Blister ME04 Chaos Ascendant",
    object: "blister",
    marker: `chaos|me ?0?4${END}`,
    sources: [retail("https://www.blazingtail.fr/77320-blister-pokemon-chaos-ascendant-me04.html")],
  },
  {
    label: "Blister ME05 Nuit noire",
    object: "blister",
    marker: `nuit|me ?0?5${END}`,
    sources: [
      retail(
        "https://lecoindesbarons.com/tradingcard-game/cartes-pokemon/booster-pokemon/pokemon-blister-nuit-noire-me05-en-francais/",
      ),
    ],
  },
  {
    label: "Blister EV10 Rivalités Destinées",
    object: "blister",
    marker: "rivalit|ev ?10",
    sources: [retail("https://www.pokelite.fr/produit/blister-rivalites-destinees-pokemon-ev10/")],
  },
  {
    label: "Booster Évolution Prismatique",
    object: "booster",
    marker: "prismatique",
    exclude: NOT_A_SINGLE_BOOSTER,
    sources: [
      market(
        "https://www.cardmarket.com/fr/Pokemon/Products/Boosters/Prismatic-Evolutions-Booster?language=2",
      ),
    ],
  },
  {
    label: "Booster Rivalités Destinées",
    object: "booster",
    marker: "rivalit|ev ?10",
    exclude: NOT_A_SINGLE_BOOSTER,
    sources: [
      retail("https://www.cultura.com/p-booster-pokemon-ev10-ecarlate-et-violet-rivalites-destinees-12763471.html"),
      retail("https://www.pokezenith.com/ev10-rivalites-destinees/74-pokemon-booster-ev10-rivalites-destinees-0196214111028.html"),
    ],
  },
  {
    label: "Booster Aventures Ensemble",
    object: "booster",
    marker: `aventures|ev ?0?9${END}`,
    exclude: NOT_A_SINGLE_BOOSTER,
    sources: [
      retail(
        "https://lesgentlemendujeu.com/pokemon-ev09-aventures-ensemble/8668-pokemon-ev09-boosters-aventures-ensemble-0196214107984.html",
      ),
      retail(
        "https://www.cultura.com/p-booster-ev09-aventures-ensemble-pokemon-modeles-aleatoires-vendu-a-l-unite-11793678.html",
      ),
    ],
  },
];

// --- Lecture d'une page ---------------------------------------------------

export type Reading = {
  cents: number | null;
  /** `null` quand la page ne dit rien du stock. */
  inStock: boolean | null;
};

/** « 12,90 », « 12.90 », « 1 299,00 € » → centimes. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number") return raw > 0 ? Math.round(raw * 100) : null;
  if (typeof raw !== "string") return null;
  let text = raw.replace(/[\s  €]/g, "");
  // Une virgule est décimale ; un point suivi de trois chiffres, des milliers.
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function availability(raw: unknown): boolean | null {
  if (typeof raw !== "string") return null;
  const value = raw.toLowerCase();
  if (/outofstock|out of stock|soldout|discontinued|rupture/.test(value)) return false;
  if (/instock|in stock|preorder|limitedavailability|onlineonly/.test(value)) return true;
  return null;
}

/** Les objets `Product` des blocs JSON-LD, où qu'ils soient imbriqués. */
function* products(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const child of node) yield* products(child);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) yield record;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    if (key in record) yield* products(record[key]);
  }
}

function attr(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1] ?? null;
}

/**
 * Prix et stock d'une page de revendeur. Les boutiques du panel
 * (PrestaShop, WooCommerce, Shopify) publient le produit en JSON-LD
 * schema.org, ou à défaut dans des balises meta : c'est ce qu'on lit, et non
 * la mise en page, qui change sans prévenir.
 */
export function readRetailPage(html: string): Reading {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    for (const product of products(data)) {
      const offers = ([] as unknown[]).concat(product.offers ?? []);
      for (const offer of offers) {
        if (!offer || typeof offer !== "object") continue;
        const o = offer as Record<string, unknown>;
        const spec = o.priceSpecification as Record<string, unknown> | undefined;
        const cents = parsePrice(o.price ?? o.lowPrice ?? spec?.price);
        if (cents !== null) return { cents, inStock: availability(o.availability) };
      }
    }
  }

  const metaPrice =
    attr(html, /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i) ??
    attr(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']product:price:amount["']/i) ??
    attr(html, /itemprop=["']price["'][^>]+content=["']([^"']+)["']/i) ??
    attr(html, /content=["']([^"']+)["'][^>]+itemprop=["']price["']/i);
  const metaStock =
    attr(html, /<meta[^>]+property=["']product:availability["'][^>]+content=["']([^"']+)["']/i) ??
    attr(html, /itemprop=["']availability["'][^>]+(?:href|content)=["']([^"']+)["']/i);

  return { cents: parsePrice(metaPrice), inStock: availability(metaStock) };
}

/** Le « À partir de » d'une fiche produit Cardmarket : le plus bas prix. */
export function readCardmarketPage(html: string): number | null {
  const match =
    /(?:À partir de|A partir de|From)\s*<\/dt>\s*<dd[^>]*>\s*([\d\s.,  ]+)\s*€/i.exec(html);
  return match ? parsePrice(match[1]) : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export type Decision = { cents: number; method: string } | null;

/**
 * La méthode du fichier de relevés : la médiane des revendeurs qui ont le
 * produit, sinon le plus bas prix Cardmarket. Un revendeur en rupture ne
 * compte pas ; un stock non précisé est pris tel quel.
 */
export function decide(retailers: Reading[], marketCents: number | null): Decision {
  const inStock = retailers
    .filter((reading) => reading.cents !== null && reading.inStock !== false)
    .map((reading) => reading.cents as number);
  if (inStock.length > 0) {
    return {
      cents: median(inStock),
      method:
        inStock.length === 1 ? "1 revendeur" : `médiane de ${inStock.length} revendeurs`,
    };
  }
  if (marketCents !== null) return { cents: marketCents, method: "Cardmarket, plus bas prix" };
  return null;
}

// --- Mise à jour ------------------------------------------------------------

export type Fetcher = (url: string) => Promise<string>;

/** Au-delà, une source est abandonnée : le bouton ne doit pas pendre. */
const TIMEOUT_MS = 8000;

export const fetchPage: Fetcher = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

export type RefreshLine = {
  label: string;
  /** Articles de l'inventaire reconnus comme ce produit. */
  matched: number;
  /** Cote retenue, ou `null` si aucune source n'a répondu avec un prix. */
  cents: number | null;
  method: string | null;
  /** Articles mis à jour. */
  updated: number;
  /** Articles laissés parce que leur cote a été saisie à la main. */
  kept: number;
  /** Ce qui n'a pas marché, source par source. */
  failures: string[];
};

function host(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

async function readSources(
  product: SealedProduct,
  fetcher: Fetcher,
): Promise<{ decision: Decision; failures: string[] }> {
  const failures: string[] = [];
  const retailers: Reading[] = [];
  let marketCents: number | null = null;

  await Promise.all(
    product.sources.map(async (source) => {
      try {
        const html = await fetcher(source.url);
        if (source.kind === "market") {
          marketCents = readCardmarketPage(html);
          if (marketCents === null) failures.push(`${host(source.url)} : prix introuvable`);
          return;
        }
        const reading = readRetailPage(html);
        if (reading.cents === null) failures.push(`${host(source.url)} : prix introuvable`);
        else if (reading.inStock === false) failures.push(`${host(source.url)} : en rupture`);
        retailers.push(reading);
      } catch (error) {
        const reason =
          error instanceof Error && error.name === "TimeoutError"
            ? "pas de réponse"
            : error instanceof Error && error.message.startsWith("HTTP")
              ? `refusé (${error.message})`
              : "inaccessible";
        failures.push(`${host(source.url)} : ${reason}`);
      }
    }),
  );

  return { decision: decide(retailers, marketCents), failures };
}

const MATCH = `kind in ('sealed', 'other')
  and lower(name) ~ $1
  and lower(name) ~ $2
  and ($3::text is null or lower(name) !~ $3)`;

/** Va chercher les prix et les pose. Une ligne de compte rendu par produit. */
export async function refreshSealedPrices(
  query: QueryRunner,
  today: string,
  fetcher: Fetcher = fetchPage,
): Promise<RefreshLine[]> {
  return Promise.all(
    SEALED_PRODUCTS.map(async (product) => {
      const match = [product.object, product.marker, product.exclude ?? null];
      const owned = await query<{ id: string; locked: boolean }>(
        `select id, (manual_value_cents is not null and value_source is distinct from 'auto') as locked
           from items where ${MATCH}`,
        match,
      );
      const line: RefreshLine = {
        label: product.label,
        matched: owned.length,
        cents: null,
        method: null,
        updated: 0,
        kept: owned.filter((row) => row.locked).length,
        failures: [],
      };
      // Pas d'article à mettre à jour : inutile d'aller sur les sites.
      if (owned.every((row) => row.locked)) return line;

      const { decision, failures } = await readSources(product, fetcher);
      line.failures = failures;
      if (!decision) return line;
      line.cents = decision.cents;
      line.method = decision.method;

      const rows = await query<{ id: string }>(
        `update items
            set manual_value_cents = $4,
                manual_value_date  = $5,
                value_source       = 'auto',
                updated_at         = now()
          where ${MATCH}
            and (manual_value_cents is null or value_source = 'auto')
         returning id`,
        [...match, decision.cents, today],
      );
      line.updated = rows.length;

      // La nouvelle cote entre aussitôt dans l'historique de chaque article.
      if (rows.length > 0) {
        await query(
          `insert into item_value_history (item_id, day, unit_cents, source)
           select id, $2::date, $3, 'auto' from unnest($1::uuid[]) as t (id)
           on conflict (item_id, day) do update
             set unit_cents = excluded.unit_cents, source = excluded.source`,
          [rows.map((row) => row.id), today, decision.cents],
        );
      }
      return line;
    }),
  );
}

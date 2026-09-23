import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthConfigured, isAuthenticated } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SCOPES,
  groupItems,
  inScope,
  isItemCategory,
  itemCategory,
  itemLabel,
  listItems,
  summarize,
  valuate,
  type EditionBadges,
  type ItemGroup,
  type Scope,
} from "@/lib/collection";
import { setIdOf } from "@/lib/card-number";
import { CHECKS, isCheckKey, matchesCheck } from "@/lib/dashboard";
import { parisToday } from "@/lib/history";
import { isDatabaseConfigured, isSchemaReady } from "@/lib/db";
import { formatCents, formatSignedCents, percentChange } from "@/lib/money";

import { Wordmark } from "../wordmark";
import { DatabaseErrorScreen, SetupScreen } from "../db-screens";
import { TabBar } from "../tab-bar";

import { migrateAction } from "./actions";
import { AddFab } from "./add-fab";

function Migrate({ title }: { title: string }) {
  return (
    <main className="page narrow">
      <h1 className="page-title">{title}</h1>
      <div className="panel form">
        <h2>Base à initialiser</h2>
        <p className="hint">
          La connexion fonctionne, mais la table de l&apos;inventaire n&apos;existe
          pas encore. Ce bouton l&apos;applique. Il est sans risque et peut être
          rejoué : rien n&apos;est jamais supprimé.
        </p>
        <form action={migrateAction}>
          <button type="submit">Initialiser la base</button>
        </form>
      </div>
      <TabBar />
    </main>
  );
}

/** Date d'achat, en jour/mois/année — la forme qu'on lit dans une liste. */
function fullDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

/**
 * Pastilles d'édition : dorée pour la note, neutres pour la langue et l'état.
 * Rien pour une carte française brute, le cas ordinaire.
 */
function Badges({ badges, label }: { badges: EditionBadges; label?: string }) {
  if (!badges.grade && !badges.language && !badges.condition) return null;
  return (
    <span className="badges" aria-label={label}>
      {badges.grade ? <span className="badge grade">{badges.grade}</span> : null}
      {badges.language ? (
        <span className="badge">{badges.language}</span>
      ) : null}
      {badges.condition ? (
        <span className="badge outline">{badges.condition}</span>
      ) : null}
    </span>
  );
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function GroupValue({ group }: { group: ItemGroup }) {
  if (group.valueCents === null) {
    return (
      <span
        className="muted"
        title={
          group.lines.some((line) => line.grader)
            ? "Carte gradée : la cote Cardmarket vaut pour une carte brute. Saisis sa valeur."
            : group.lines.some((line) => line.cardId)
            ? "Pas encore cotée sur Cardmarket. Saisis une valeur pour la valoriser."
            : "Aucune valeur saisie pour cet article."
        }
      >
        —
      </span>
    );
  }

  // Une seule origine possible quand toutes les lignes s'accordent ; sinon on
  // ne prétend pas d'où vient le chiffre.
  const sources = new Set(
    group.lines
      .filter((line) => line.totalValueCents !== null)
      .map((line) => line.valueSource),
  );
  const source = sources.size === 1 ? [...sources][0] : null;

  const day =
    group.lines.length === 1
      ? shortDate(
          group.lines[0].valueSource === "manual"
            ? group.lines[0].manualValueDate
            : group.lines[0].quoteUpdated,
        )
      : null;

  return (
    <span>
      {formatCents(group.valueCents)}
      {source ? (
        <em className="source">
          {source === "manual" ? "saisie" : "cote"}
          {day ? ` ${day}` : ""}
        </em>
      ) : null}
    </span>
  );
}

export type InventorySearchParams = Promise<{
  type?: string;
  vue?: string;
  verifier?: string;
}>;

/**
 * Page d'inventaire, commune aux cartes (`/collection`) et au scellé
 * (`/scelle`) : même présentation, chacune sur ses propres articles.
 */
export async function InventoryPage({
  scope,
  searchParams,
}: {
  scope: Scope;
  searchParams: InventorySearchParams;
}) {
  const { path, title } = SCOPES[scope];
  const other: Scope = scope === "cards" ? "sealed" : "cards";
  const { type, vue, verifier } = await searchParams;
  const filter = isItemCategory(type) ? type : null;
  // Arrivée depuis « À vérifier » du tableau de bord : seules les lignes
  // concernées, pour les corriger sans les chercher.
  const check = isCheckKey(verifier) ? verifier : null;
  const gallery = vue === "images";
  const missing: string[] = [];
  if (!isAuthConfigured()) missing.push("APP_PASSWORD", "AUTH_SECRET");
  if (!isDatabaseConfigured()) missing.push("DATABASE_URL");
  if (missing.length > 0)
    return <SetupScreen title={title} missing={missing} />;

  if (!(await isAuthenticated())) redirect(`/login?next=${path}`);

  try {
    if (!(await isSchemaReady())) return <Migrate title={title} />;
  } catch (error) {
    return (
      <DatabaseErrorScreen
        title={title}
        message={
          error instanceof Error ? error.message : "Erreur de connexion inconnue."
        }
      />
    );
  }

  let items;
  let all;
  try {
    all = await listItems();
    // Valoriser seulement la page affichée : les cartes demandent un appel
    // TCGdex chacune, le scellé n'a pas à les attendre.
    items = await valuate(all.filter((item) => inScope(item, scope)));
  } catch (error) {
    // Typiquement une colonne ajoutée par une mise à jour et pas encore
    // appliquée : le message doit dire quoi faire, pas seulement ce qui casse.
    return (
      <DatabaseErrorScreen
        title={title}
        message={
          error instanceof Error ? error.message : "Erreur de lecture inconnue."
        }
      />
    );
  }

  // Les catégories présentes, dans l'ordre fixe : une catégorie garde sa
  // couleur quel que soit le filtre actif.
  const counts = new Map<string, number>();
  for (const item of items) {
    const category = itemCategory(item);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const available = CATEGORY_ORDER.filter((category) => counts.has(category));

  // Le filtre porte aussi sur les totaux : un total qui ne correspond pas aux
  // lignes affichées juste en dessous ne veut rien dire.
  const today = parisToday();
  // Une vérification du tableau de bord porte sur les deux inventaires : on
  // dit combien de lignes concernées attendent sur l'autre page.
  const elsewhere = check
    ? (await valuate(all.filter((item) => !inScope(item, scope)))).filter(
        (item) => matchesCheck(item, check, today),
      ).length
    : 0;
  const shown = items.filter(
    (item) =>
      (!filter || itemCategory(item) === filter) &&
      (!check || matchesCheck(item, check, today)),
  );

  /** Conserve la vue courante en changeant de filtre, et inversement. */
  const link = (next: {
    type?: string | null;
    vue?: string | null;
    verifier?: string | null;
  }) => {
    const params = new URLSearchParams();
    const category = next.type === undefined ? filter : next.type;
    const view = next.vue === undefined ? (gallery ? "images" : null) : next.vue;
    if (category) params.set("type", category);
    if (view) params.set("vue", view);
    const pending = next.verifier === undefined ? check : next.verifier;
    if (pending) params.set("verifier", pending);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const summary = summarize(shown);
  const groups = groupItems(shown);
  // Les extensions déjà possédées, de la plus récemment alimentée à la plus
  // ancienne : la recherche d'ajout les propose en premier.
  const ownedSetIds = [
    ...new Set(
      items
        .map((item) => (item.cardId ? setIdOf(item.cardId) : null))
        .filter((id) => id !== null),
    ),
  ];
  // Comparé au prix d'achat des seules lignes valorisées : rapporter une
  // valeur partielle à l'investissement total donnerait un pourcentage faux.
  const change = percentChange(
    summary.valuedPurchaseCents,
    summary.totalValueCents,
  );

  return (
    <main className="page">
      <header className="masthead">
        <div className="wordmark">
          <Link href="/">
            <Wordmark />
          </Link>
        </div>
      </header>

      <h1 className="page-title">{title}</h1>

      <section className="summary">
        <div className="summary-main">
          <span className="summary-label">Valeur actuelle</span>
          <span className="summary-value">
            {formatCents(summary.totalValueCents)}
          </span>
          <span className={`pill ${summary.gainCents >= 0 ? "up" : "down"}`}>
            {formatSignedCents(summary.gainCents)}
            {change === undefined ? null : (
              <small>
                {change > 0 ? "+" : ""}
                {change} %
              </small>
            )}
          </span>
        </div>

        <div className="summary-aside">
          <div className="summary-item">
            <strong>{formatCents(summary.totalPurchaseCents)}</strong>
            <span>investi</span>
          </div>
          <div className="summary-item">
            <strong>{summary.unitCount}</strong>
            <span>
              article{summary.unitCount > 1 ? "s" : ""}
              {summary.unvaluedCount > 0
                ? `, ${summary.unvaluedCount} sans cote`
                : ""}
              {summary.withoutPriceCount > 0
                ? `, ${summary.withoutPriceCount} sans prix`
                : ""}
            </span>
          </div>
        </div>
      </section>

      {check ? (
        <div className="check-filter" role="status">
          <span>{CHECKS.find((entry) => entry.key === check)?.label}</span>
          <span className="check-filter-links">
            {elsewhere > 0 ? (
              <Link href={`${SCOPES[other].path}?verifier=${check}`}>
                {elsewhere} dans {other === "sealed" ? "le scellé" : "les cartes"} →
              </Link>
            ) : null}
            <Link href={link({ verifier: null })}>Tout afficher</Link>
          </span>
        </div>
      ) : null}

      {available.length > 1 ? (
        <div className="chips">
          <Link
            href={link({ type: null })}
            className="chip"
            aria-pressed={filter === null}
          >
            Tout
            <span className="count">{items.length}</span>
          </Link>

          {available.map((category) => (
            <Link
              key={category}
              href={link({ type: category })}
              className="chip"
              aria-pressed={filter === category}
              style={{ ["--dot" as string]: `var(--cat-${category})` }}
            >
              <span className="dot" aria-hidden="true" />
              {CATEGORY_LABELS[category]}
              <span className="count">{counts.get(category)}</span>
            </Link>
          ))}
        </div>
      ) : null}


      {items.length > 0 ? (
        <div className="listbar">
          <p className="listbar-count">
            {groups.length} produit{groups.length > 1 ? "s" : ""}
            {summary.unitCount !== groups.length
              ? ` · ${summary.unitCount} article${summary.unitCount > 1 ? "s" : ""}`
              : ""}
          </p>

          <div className="views">
            <Link
              href={link({ vue: null })}
              className="chip"
              aria-pressed={!gallery}
            >
              Liste
            </Link>
            <Link
              href={link({ vue: "images" })}
              className="chip"
              aria-pressed={gallery}
            >
              Images
            </Link>
          </div>
        </div>
      ) : null}




      {items.length === 0 ? (
        <div className="panel">
          <h2>{scope === "cards" ? "Aucune carte" : "Aucun scellé"}</h2>
          <p className="hint">
            {scope === "cards" ? (
              <>
                Ajoute ta première carte depuis le{" "}
                <Link href="/catalogue">catalogue</Link>, ou avec le bouton{" "}
                <strong>+</strong> en bas à droite de l&apos;écran.
              </>
            ) : (
              <>
                Ajoute ton premier produit scellé avec le bouton{" "}
                <strong>+</strong>, en bas à droite de l&apos;écran.
              </>
            )}
          </p>
        </div>
      ) : gallery ? (
        <div className="gallery">
          {groups.map((group) => (
            <div className="tile-cell" key={group.key}>
              <Link
                href={`/collection/${group.lines[0].id}`}
                className="tile"
                title={[group.name, itemLabel(group), group.edition]
                  .filter(Boolean)
                  .join(" — ")}
              >
                <span
                  className="tile-mark"
                  aria-hidden="true"
                  style={{
                    ["--dot" as string]: `var(--cat-${itemCategory(group)})`,
                  }}
                />
                {group.image ? (
                  <img src={group.image} alt={group.name} loading="lazy" />
                ) : (
                  <span className="tile-fallback">{group.name}</span>
                )}
                {group.quantity > 1 ? (
                  <span className="tile-qty">×{group.quantity}</span>
                ) : null}
              </Link>
              {/* Sous l'image, pas dessus : le visuel reste intact. L'état n'y
                  figure pas, la tuile n'a pas la place de tout dire. */}
              <Badges
                badges={{ ...group.badges, condition: null }}
                label={group.edition ?? undefined}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th className="num">Qté</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Achat</th>
                <th className="num">Valeur</th>
                <th className="num">Plus-value</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.key}>
                  <td className="title-cell">
                    <div className="title-row">
                      {group.image ? (
                        <img className="thumb" src={group.image} alt="" />
                      ) : (
                        <span className="thumb empty" aria-hidden="true" />
                      )}
                      <div className="title-text">
                        {group.lines.length === 1 ? (
                          <Link href={`/collection/${group.lines[0].id}`}>
                            {group.name}
                          </Link>
                        ) : (
                          <span className="group-name">{group.name}</span>
                        )}
                        <Badges
                          badges={group.badges}
                          label={group.edition ?? undefined}
                        />
                        <span className="muted block">
                          <span
                            className="cat-mark"
                            aria-hidden="true"
                            style={{
                              ["--dot" as string]: `var(--cat-${itemCategory(group)})`,
                            }}
                          />
                          {[itemLabel(group), group.setName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {/* Plusieurs achats du même produit : chacun reste
                            atteignable, une moyenne ne doit pas les effacer. */}
                        {group.lines.length > 1 ? (
                          <span className="purchases">
                            {group.lines.map((line) => (
                              <Link
                                key={line.id}
                                href={`/collection/${line.id}`}
                                title={`Modifier cet achat`}
                              >
                                {line.quantity} × {formatCents(line.purchasePriceCents)}
                                {fullDate(line.purchaseDate)
                                  ? ` le ${fullDate(line.purchaseDate)}`
                                  : ""}
                              </Link>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="num" data-label="Quantité">
                    <span className="sr-only">Quantité </span>
                    {group.quantity}
                  </td>

                  <td className="num" data-label="Prix unitaire">
                    <span className="sr-only">Prix unitaire </span>
                    <span>
                      {formatCents(group.unitPurchaseCents)}
                      {group.lines.length > 1 ? (
                        <em className="source">moyen</em>
                      ) : null}
                    </span>
                  </td>

                  <td className="num" data-label="Achat">
                    <span className="sr-only">Achat </span>
                    {formatCents(group.purchaseCents)}
                  </td>

                  <td className="num" data-label="Valeur">
                    <span className="sr-only">Valeur </span>
                    <GroupValue group={group} />
                  </td>

                  <td
                    className={`num ${
                      group.gainCents === null
                        ? "muted"
                        : group.gainCents >= 0
                          ? "up"
                          : "down"
                    }`}
                    data-label="Plus-value"
                  >
                    <span className="sr-only">Plus-value </span>
                    {group.gainCents === null
                      ? "—"
                      : formatSignedCents(group.gainCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddFab
        ownedSetIds={ownedSetIds}
        defaultKind={scope === "cards" ? "single" : "sealed"}
      />

      <TabBar />
    </main>
  );
}

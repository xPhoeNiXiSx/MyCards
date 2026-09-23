import { query } from "@/lib/db";

/**
 * Réglages de l'application, en base : ils suivent l'utilisateur d'un
 * appareil à l'autre, ce que ne ferait pas le stockage du navigateur.
 */
export type Settings = {
  /** Masquer la série Pokémon TCG Pocket (jeu mobile) dans le catalogue. */
  hidePocket: boolean;
  /**
   * Extensions affichées dans le catalogue. `null` tant que rien n'a été
   * choisi : le catalogue applique alors une sélection par défaut.
   */
  catalogueSets: string[] | null;
};

export const DEFAULT_SETTINGS: Settings = {
  hidePocket: true,
  catalogueSets: null,
};

const KEYS = {
  hidePocket: "catalogue.hide_pocket",
  catalogueSets: "catalogue.sets",
} as const;

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: unknown }>(
    `select key, value from app_settings where key = any($1)`,
    [Object.values(KEYS)],
  );
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  const hidePocket = stored.get(KEYS.hidePocket);
  const catalogueSets = stored.get(KEYS.catalogueSets);

  return {
    hidePocket:
      typeof hidePocket === "boolean" ? hidePocket : DEFAULT_SETTINGS.hidePocket,
    catalogueSets:
      Array.isArray(catalogueSets) &&
      catalogueSets.every((id) => typeof id === "string")
        ? catalogueSets
        : DEFAULT_SETTINGS.catalogueSets,
  };
}

/** Lit les réglages, ou les valeurs par défaut si la base ne répond pas. */
export async function getSettingsOrDefaults(): Promise<Settings> {
  try {
    return await getSettings();
  } catch (error) {
    console.warn("[settings] lecture impossible", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSetting<K extends keyof Settings>(
  name: K,
  value: Settings[K],
): Promise<void> {
  // `null` efface le réglage : on revient au comportement par défaut.
  if (value === null) {
    await query(`delete from app_settings where key = $1`, [KEYS[name]]);
    return;
  }
  await query(
    `insert into app_settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [KEYS[name], JSON.stringify(value)],
  );
}

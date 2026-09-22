/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import { setQueryRunner } from "../lib/db";
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  summarize,
  updateItem,
  valuate,
  type ItemInput,
} from "../lib/collection";
import { formatCents, parseEuros, percentChange } from "../lib/money";
import { readQuote } from "../lib/pricing";

const checks: string[] = [];

function ok(label: string) {
  checks.push(label);
}

async function main() {
  const pg = new PGlite();
  setQueryRunner(async (text, params = []) => {
    const result = await pg.query(text, params as unknown[]);
    return result.rows as never[];
  });

  await pg.exec(await readFile("db/schema.sql", "utf8"));
  ok("le schéma s'applique");

  // Rejouer le schéma ne doit rien casser : les déploiements le relancent.
  await pg.exec(await readFile("db/schema.sql", "utf8"));
  ok("le schéma est idempotent");

  const etb: ItemInput = {
    kind: "sealed",
    name: "Coffret dresseur d'élite 30 ans",
    cardId: null,
    setName: "Célébration 30 ans",
    quantity: 2,
    purchasePriceCents: 4990,
    purchaseDate: "2026-09-17",
    manualValueCents: 6200,
    manualValueDate: "2026-09-22",
    notes: null,
  };

  const created = await createItem(etb);
  assert.equal(created.name, etb.name);
  assert.equal(created.quantity, 2);
  assert.equal(created.purchaseDate, "2026-09-17");
  assert.equal(created.manualValueCents, 6200);
  ok("insertion et relecture des colonnes");

  const fetched = await getItem(created.id);
  assert.deepEqual(fetched, created);
  ok("getItem renvoie la même ligne");

  // Une carte sans cote manuelle ni identifiant : doit rester non valorisée.
  await createItem({
    ...etb,
    kind: "single",
    name: "Dracaufeu 30 ans",
    quantity: 1,
    purchasePriceCents: 1200,
    manualValueCents: null,
    manualValueDate: null,
  });

  const items = await listItems();
  assert.equal(items.length, 2);
  ok("listItems renvoie les deux lignes");

  const valued = await valuate(items);
  const sealed = valued.find((item) => item.kind === "sealed")!;
  const single = valued.find((item) => item.kind === "single")!;

  assert.equal(sealed.valueSource, "manual");
  assert.equal(sealed.totalPurchaseCents, 9980); // 49,90 × 2
  assert.equal(sealed.totalValueCents, 12400); // 62,00 × 2
  assert.equal(sealed.gainCents, 2420);
  ok("valorisation manuelle et plus-value");

  assert.equal(single.valueSource, "none");
  assert.equal(single.totalValueCents, null);
  assert.equal(single.gainCents, null);
  ok("une ligne sans cote reste non valorisée");

  const summary = summarize(valued);
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.unitCount, 3);
  assert.equal(summary.totalValueCents, 12400);
  assert.equal(summary.unvaluedCount, 1);
  ok("le total ignore les lignes sans cote");

  await updateItem(created.id, { ...etb, quantity: 3, manualValueCents: 7000 });
  const updated = await getItem(created.id);
  assert.equal(updated?.quantity, 3);
  assert.equal(updated?.manualValueCents, 7000);
  ok("mise à jour");

  await deleteItem(created.id);
  assert.equal(await getItem(created.id), undefined);
  assert.equal((await listItems()).length, 1);
  ok("suppression");

  // --- Montants ---------------------------------------------------------

  assert.equal(parseEuros("12,50"), 1250);
  assert.equal(parseEuros("12.50"), 1250);
  assert.equal(parseEuros("1 299,99 €"), 129999);
  assert.equal(parseEuros(""), undefined);
  assert.equal(parseEuros(null), undefined);
  assert.equal(parseEuros("abc"), null);
  assert.equal(parseEuros("-3"), null);
  ok("lecture des montants saisis");

  assert.equal(formatCents(129999).replace(/ | /g, " "), "1 299,99 €");
  assert.equal(percentChange(10000, 12500), 25);
  assert.equal(percentChange(0, 100), undefined);
  ok("formatage et variation");

  // --- Lecture des cotes TCGdex ----------------------------------------

  assert.equal(
    readQuote({ cardmarket: { updated: "2026-09-21", unit: "EUR", trend: 3.5, low: 1.2 } })
      ?.cents,
    350,
  );
  ok("la tendance prime sur le prix bas");

  assert.equal(
    readQuote({ cardmarket: { low: 1.25 } })?.cents,
    125,
  );
  ok("repli sur le prix bas quand la tendance manque");

  assert.equal(
    readQuote({ cardmarket: { holo: { trend: 9 }, normal: { trend: 2 } } })?.cents,
    200,
  );
  ok("la variante standard prime sur la holo");

  assert.equal(readQuote({ cardmarket: { holo: { trend: 9 } } })?.cents, 900);
  ok("repli sur la holo si elle est seule");

  assert.equal(readQuote(undefined), undefined);
  assert.equal(readQuote({ tcgplayer: { market: 4 } }), undefined);
  assert.equal(readQuote({ cardmarket: { updated: "2026-09-21" } }), undefined);
  ok("absence de cote gérée sans exception");

  await pg.close();

  console.log(checks.map((check) => `  ✓ ${check}`).join("\n"));
  console.log(`\n${checks.length} vérifications passées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import { runMigrations, isSchemaReady, setQueryRunner } from "../lib/db";
import {
  bestGain,
  breakdown,
  createItem,
  markAsOwned,
  deleteItem,
  getItem,
  listItems,
  summarize,
  updateItem,
  valuate,
  type ItemInput,
} from "../lib/collection";
import { parseImageUrl } from "../lib/images";
import { formatCents, parseEuros, percentChange } from "../lib/money";
import { readQuote } from "../lib/pricing";
import { newToken, safeEquals, verifyToken } from "../lib/session";

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

  assert.equal(await isSchemaReady(), false);
  ok("une base vide est détectée comme non initialisée");

  await runMigrations();
  assert.equal(await isSchemaReady(), true);
  ok("le schéma s'applique depuis l'application");

  // Rejouer le schéma ne doit rien casser : le bouton reste cliquable.
  await runMigrations();
  ok("le schéma est idempotent");

  const etb: ItemInput = {
    status: "owned",
    kind: "sealed",
    name: "Coffret dresseur d'élite 30 ans",
    cardId: null,
    setName: "Célébration 30 ans",
    quantity: 2,
    purchasePriceCents: 4990,
    purchaseDate: "2026-09-17",
    manualValueCents: 6200,
    manualValueDate: "2026-09-22",
    imageUrl: "https://exemple.test/etb.jpg",
    notes: null,
  };

  const created = await createItem(etb);
  assert.equal(created.name, etb.name);
  assert.equal(created.quantity, 2);
  assert.equal(created.purchaseDate, "2026-09-17");
  assert.equal(created.manualValueCents, 6200);
  assert.equal(created.imageUrl, "https://exemple.test/etb.jpg");
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
    imageUrl: null,
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

  // Le scellé n'a que l'URL saisie ; la carte sans URL ni fiche n'a rien.
  assert.equal(sealed.image, "https://exemple.test/etb.jpg");
  assert.equal(single.image, null);
  ok("le visuel saisi est retenu, l'absence n'invente rien");

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

  // --- Tableau de bord --------------------------------------------------

  const parts = breakdown(valued);
  assert.equal(parts.length, 2);
  // Trié par valeur : le scellé valorisé passe devant la carte sans cote.
  assert.equal(parts[0].kind, "sealed");
  assert.equal(parts[0].units, 2);
  assert.equal(parts[0].valueCents, 12400);
  assert.equal(parts[0].share, 100);
  assert.equal(parts[1].kind, "single");
  assert.equal(parts[1].valueCents, 0);
  assert.equal(parts[1].share, 0);
  ok("répartition par type, triée et en parts");

  assert.equal(bestGain(valued)?.kind, "sealed");
  // Sans aucune ligne valorisée, il n'y a pas de meilleure plus-value.
  assert.equal(bestGain(valued.filter((item) => item.kind === "single")), undefined);
  ok("meilleure plus-value, et son absence");

  // Un inventaire sans valeur connue ne doit pas produire de part infinie.
  assert.deepEqual(
    breakdown(valued.filter((item) => item.kind === "single")).map((p) => p.share),
    [0],
  );
  ok("aucune part calculée sur un total nul");

  await updateItem(created.id, { ...etb, quantity: 3, manualValueCents: 7000 });
  const updated = await getItem(created.id);
  assert.equal(updated?.quantity, 3);
  assert.equal(updated?.manualValueCents, 7000);
  ok("mise à jour");

  // --- Liste d'achats ---------------------------------------------------

  const vise = await createItem({
    ...etb,
    status: "wanted",
    name: "Display Écarlate et Violet",
    quantity: 1,
    // Un article visé n'a ni prix payé ni valeur : il n'est pas encore à toi.
    purchasePriceCents: 0,
    purchaseDate: null,
    manualValueCents: null,
    manualValueDate: null,
    imageUrl: null,
  });

  assert.equal(vise.status, "wanted");
  ok("un article peut être créé comme visé");

  // Les deux listes sont étanches.
  assert.equal(
    (await listItems("owned")).some((item) => item.id === vise.id),
    false,
  );
  assert.deepEqual(
    (await listItems("wanted")).map((item) => item.id),
    [vise.id],
  );
  ok("visé et possédé ne se mélangent pas");

  await markAsOwned(vise.id, 13500, "2026-09-23");
  const achete = await getItem(vise.id);
  assert.equal(achete?.status, "owned");
  assert.equal(achete?.purchasePriceCents, 13500);
  assert.equal(achete?.purchaseDate, "2026-09-23");
  // Ce qui avait été saisi survit à la bascule.
  assert.equal(achete?.name, "Display Écarlate et Violet");
  ok("l'achat bascule la ligne sans rien perdre");

  // Rejouer l'achat sur une ligne déjà possédée ne doit rien écraser.
  await markAsOwned(vise.id, 99900, "2026-01-01");
  assert.equal((await getItem(vise.id))?.purchasePriceCents, 13500);
  ok("l'achat ne s'applique qu'à un article encore visé");

  await deleteItem(vise.id);

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

  // Payload réel renvoyé par TCGdex (carte me04-001, relevé du 21/09/2026).
  const reel = {
    cardmarket: {
      updated: "2026-09-21T22:54:33.740Z",
      unit: "EUR",
      idProduct: 886393,
      avg: 0.27,
      low: 0.02,
      trend: 0.15,
      avg1: 0.02,
      avg7: 0.03,
      avg30: 0.27,
      "avg-holo": 0.07,
      "low-holo": 0.02,
      "trend-holo": 0.06,
      "avg1-holo": 0.04,
      "avg7-holo": 0.07,
      "avg30-holo": 0.07,
    },
    tcgplayer: null,
  };

  const quote = readQuote(reel);
  assert.equal(quote?.cents, 15);
  assert.equal(quote?.field, "cardmarket.trend");
  assert.equal(quote?.updated, "2026-09-21T22:54:33.740Z");
  ok("payload réel : tendance retenue, en centimes, avec sa date");

  // idProduct est un nombre mais pas un prix : il ne doit jamais être retenu.
  assert.equal(readQuote({ cardmarket: { idProduct: 886393 } }), undefined);
  ok("un identifiant produit n'est pas confondu avec un prix");

  assert.equal(readQuote({ cardmarket: { avg7: 1.25, low: 0.5 } })?.cents, 125);
  ok("repli sur la moyenne 7 jours sans tendance");

  assert.equal(
    readQuote({ cardmarket: { "trend-holo": 9, "low-holo": 3 } })?.field,
    "cardmarket.trend-holo",
  );
  ok("repli sur la variante holo quand elle est seule");

  assert.equal(
    readQuote({ cardmarket: { trend: 2, "trend-holo": 9 } })?.cents,
    200,
  );
  ok("la variante standard prime sur la holo");

  // Une devise étrangère produirait un montant faux sans prévenir.
  assert.equal(readQuote({ cardmarket: { unit: "USD", trend: 5 } }), undefined);
  ok("une devise autre que l'euro est refusée");

  // Cas du set anniversaire au moment de l'écriture : pas encore coté.
  assert.equal(readQuote({ cardmarket: null, tcgplayer: null }), undefined);
  assert.equal(readQuote(undefined), undefined);
  assert.equal(readQuote({ tcgplayer: { market: 4 } }), undefined);
  ok("absence de cote gérée sans exception");

  // --- Session ----------------------------------------------------------

  process.env.AUTH_SECRET = "secret-de-test";

  const token = await newToken();
  assert.equal(await verifyToken(token), true);
  ok("un jeton fraîchement émis est accepté");

  assert.equal(await verifyToken(undefined), false);
  assert.equal(await verifyToken("nimportequoi"), false);
  assert.equal(await verifyToken("1700000000.signaturebidon"), false);
  ok("un jeton absent ou mal signé est refusé");

  // Rejouer un jeton signé avec une autre clé ne doit rien donner.
  const [issued] = token.split(".");
  process.env.AUTH_SECRET = "une-autre-clef";
  assert.equal(await verifyToken(token), false);
  ok("un jeton signé avec une autre clé est refusé");

  process.env.AUTH_SECRET = "secret-de-test";
  // Un jeton daté d'il y a plus de 30 jours est périmé.
  const vieux = Number(issued) - 31 * 24 * 3600 * 1000;
  const { signPayload } = await import("../lib/session");
  assert.equal(
    await verifyToken(`${vieux}.${await signPayload(String(vieux))}`),
    false,
  );
  ok("un jeton de plus de 30 jours est périmé");

  assert.equal(safeEquals("abc", "abc"), true);
  assert.equal(safeEquals("abc", "abd"), false);
  assert.equal(safeEquals("abc", "abcd"), false);
  ok("comparaison à temps constant");

  // --- Adresses d'images ------------------------------------------------

  assert.equal(parseImageUrl(null), undefined);
  assert.equal(parseImageUrl("  "), undefined);
  assert.equal(parseImageUrl("https://exemple.test/a.png"), "https://exemple.test/a.png");
  assert.equal(parseImageUrl("http://exemple.test/a.png"), "http://exemple.test/a.png");
  ok("les adresses http et https sont acceptées");

  // Le champ finit dans un `src` : tout autre schéma est refusé.
  assert.equal(parseImageUrl("javascript:alert(1)"), null);
  assert.equal(parseImageUrl("data:image/png;base64,AAAA"), null);
  assert.equal(parseImageUrl("file:///etc/passwd"), null);
  assert.equal(parseImageUrl("pas une url"), null);
  ok("tout autre schéma est refusé");

  await pg.close();

  console.log(checks.map((check) => `  ✓ ${check}`).join("\n"));
  console.log(`\n${checks.length} vérifications passées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

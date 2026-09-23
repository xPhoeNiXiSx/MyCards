/**
 * Vérifie la couche données contre un vrai Postgres, en mémoire (PGlite).
 * Le schéma et les requêtes exécutés ici sont exactement ceux de production :
 * seul le pilote change, via `setQueryRunner`.
 *
 *   npm test
 */

import assert from "node:assert/strict";

import { PGlite } from "@electric-sql/pglite";

import { runMigrations, isSchemaReady, query, setQueryRunner } from "../lib/db";
import {
  bestGain,
  breakdown,
  editionLabel,
  gradeLabel,
  parseGrade,
  groupItems,
  itemLabel,
  createItem,
  markAsOwned,
  deleteItem,
  getItem,
  listItems,
  summarize,
  updateItem,
  valuate,
  valuateWith,
  type ItemInput,
} from "../lib/collection";
import type { CardDetail } from "../lib/tcgdex";
import { parseImageUrl } from "../lib/images";
import { formatCents, parseEuros, percentChange } from "../lib/money";
import { readQuote } from "../lib/pricing";
import {
  MAX_FAILURES,
  clearFailures,
  lockedMinutes,
  recordFailure,
} from "../lib/throttle";
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
    sealedType: "etb",
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
    language: null,
    condition: null,
    grader: null,
    grade: null,
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
  ok("la valeur actuelle ignore les lignes sans cote");

  // L'investi, lui, compte tout : 49,90 × 2 pour l'ETB, 12,00 pour la carte
  // non valorisée. Ne pas la compter reviendrait à oublier de l'argent dépensé.
  assert.equal(summary.totalPurchaseCents, 9980 + 1200);
  ok("l'investi compte les lignes non valorisées");

  // La plus-value se rapporte au seul achat des lignes valorisées.
  assert.equal(summary.valuedPurchaseCents, 9980);
  assert.equal(summary.gainCents, 12400 - 9980);
  ok("la plus-value et sa base portent sur les mêmes lignes");

  // Un prix laissé vide vaut 0 en base : il doit être compté, pas oublié.
  assert.equal(summary.withoutPriceCount, 0);
  const sansPrix = await createItem({
    ...etb,
    name: "Carte offerte",
    quantity: 1,
    purchasePriceCents: 0,
    manualValueCents: null,
    manualValueDate: null,
    imageUrl: null,
  });
  assert.equal(
    summarize(await valuate(await listItems())).withoutPriceCount,
    1,
  );
  await deleteItem(sansPrix.id);
  ok("les lignes sans prix d'achat sont comptées");

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

  // --- Sous-type de scellé ----------------------------------------------

  assert.equal(created.sealedType, "etb");
  assert.equal(itemLabel(created), "Coffret dresseur d'élite (ETB)");
  // Une carte n'a pas de sous-type : elle garde son libellé de type.
  assert.equal(itemLabel({ kind: "single", sealedType: null }), "Carte à l'unité");
  ok("le sous-type de scellé sert de libellé");

  // Deux scellés homonymes de sous-types différents restent distincts.
  const varies = groupItems(
    await valuate([
      { ...etb, id: "x", name: "Nuit noire", sealedType: "blister" },
      { ...etb, id: "y", name: "Nuit noire", sealedType: "tripack" },
    ]),
  );
  assert.equal(varies.length, 2);
  ok("le sous-type distingue deux produits de même nom");

  // --- Regroupement par produit ----------------------------------------

  // Un second achat du même ETB, à un autre prix.
  const second = await createItem({
    ...etb,
    quantity: 1,
    purchasePriceCents: 5500,
    manualValueCents: null,
    manualValueDate: null,
  });

  const groupes = groupItems(await valuate(await listItems()));
  const etbGroupe = groupes.find((groupe) => groupe.kind === "sealed")!;

  assert.equal(groupes.length, 2);
  assert.equal(etbGroupe.lines.length, 2);
  assert.equal(etbGroupe.quantity, 3);
  assert.equal(etbGroupe.purchaseCents, 9980 + 5500);
  // Moyenne pondérée : 154,80 € pour 3 exemplaires.
  assert.equal(etbGroupe.unitPurchaseCents, Math.round((9980 + 5500) / 3));
  ok("les achats d'un même produit forment une ligne");

  // Le second achat n'est pas valorisé : seul le premier compte dans la valeur.
  assert.equal(etbGroupe.valueCents, 12400);
  assert.equal(etbGroupe.gainCents, 12400 - 9980);
  ok("la valeur d'un groupe ne compte que ses lignes valorisées");

  // Un produit sans identifiant ne doit pas absorber une carte homonyme.
  const distincts = groupItems(
    await valuate([
      { ...etb, id: "a", name: "Pikachu", kind: "single", cardId: "30th-023" },
      { ...etb, id: "b", name: "Pikachu", kind: "single", cardId: "sv09-012" },
    ]),
  );
  assert.equal(distincts.length, 2);
  ok("deux cartes homonymes de sets différents restent distinctes");

  await deleteItem(second.id);

  // --- Langue, état, gradation ------------------------------------------

  const gradee = await createItem({
    ...etb,
    kind: "single",
    sealedType: null,
    name: "Pikachu",
    cardId: "30th-023",
    quantity: 1,
    manualValueCents: null,
    manualValueDate: null,
    language: "ja",
    condition: null,
    grader: "psa",
    grade: "9.5",
  });
  assert.deepEqual(await getItem(gradee.id), gradee);
  assert.equal(gradee.language, "ja");
  assert.equal(gradee.grader, "psa");
  assert.equal(gradee.grade, "9.5");
  ok("langue et gradation sont enregistrées et relues");
  await deleteItem(gradee.id);

  assert.equal(parseGrade("10"), "10");
  assert.equal(parseGrade("9,5"), "9.5");
  assert.equal(parseGrade(" 9.5 "), "9.5");
  assert.equal(parseGrade(""), undefined);
  assert.equal(parseGrade(null), undefined);
  assert.equal(parseGrade("11"), null);
  assert.equal(parseGrade("0"), null);
  assert.equal(parseGrade("9.3"), null);
  assert.equal(parseGrade("dix"), null);
  ok("lecture des notes de gradation");

  const brute = { language: null, condition: null, grader: null, grade: null };
  assert.equal(editionLabel(brute), null);
  assert.equal(editionLabel({ ...brute, language: "fr" }), null);
  assert.equal(editionLabel({ ...brute, condition: "nm" }), "Near Mint");
  assert.equal(
    editionLabel({ ...brute, language: "ja", grader: "psa", grade: "9.5" }),
    "PSA 9,5 · Japonais",
  );
  assert.equal(gradeLabel({ grader: "psa", grade: null }), null);
  ok("libellé d'édition : gradation, sinon état, et langue étrangère");

  // Une gradée et la même carte brute ne forment pas un seul produit ; une
  // japonaise et une française non plus.
  const pika = { ...etb, kind: "single" as const, sealedType: null, name: "Pikachu", cardId: "30th-023" };
  const editions = groupItems(
    await valuate([
      { ...pika, id: "p1" },
      { ...pika, id: "p2", grader: "psa", grade: "10" },
      { ...pika, id: "p3", language: "ja" },
      { ...pika, id: "p4", language: "fr" },
    ]),
  );
  assert.equal(editions.length, 3);
  ok("gradation et langue séparent les groupes, le français est le défaut");

  // L'état n'est affiché pour un groupe que s'il est le même partout.
  const etats = groupItems(
    await valuate([
      { ...pika, id: "e1", condition: "nm" },
      { ...pika, id: "e2", condition: "ex" },
    ]),
  );
  assert.equal(etats.length, 1);
  assert.equal(etats[0].edition, null);
  ok("un état qui diffère d'un achat à l'autre n'est pas affiché");

  // La cote Cardmarket vaut pour une carte brute : une gradée sans valeur
  // saisie reste non valorisée plutôt que d'hériter d'un chiffre faux.
  const fiches = new Map([
    ["30th-023", { pricing: { cardmarket: { trend: 2 } } } as unknown as CardDetail],
  ]);
  const sansValeur = { ...pika, manualValueCents: null, manualValueDate: null };
  const [brutCote, gradeeCote, gradeeSaisie] = valuateWith(
    [
      { ...sansValeur, id: "g0" },
      { ...sansValeur, id: "g1", grader: "psa", grade: "10" },
      { ...sansValeur, id: "g2", grader: "psa", grade: "10", manualValueCents: 25000 },
    ],
    fiches,
  );
  assert.equal(brutCote.valueSource, "market");
  assert.equal(brutCote.currentUnitCents, 200);
  assert.equal(gradeeCote.valueSource, "none");
  assert.equal(gradeeCote.totalValueCents, null);
  assert.equal(gradeeSaisie.valueSource, "manual");
  assert.equal(gradeeSaisie.currentUnitCents, 25000);
  ok("une carte gradée ne reprend pas la cote d'une carte brute");

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

  // --- Limitation des connexions ---------------------------------------

  const ip = "203.0.113.7";
  assert.equal(await lockedMinutes(ip), 0);
  for (let attempt = 1; attempt < MAX_FAILURES; attempt++) {
    await recordFailure(ip);
  }
  assert.equal(await lockedMinutes(ip), 0);
  ok("les premiers échecs ne bloquent pas");

  await recordFailure(ip);
  const attente = await lockedMinutes(ip);
  assert.ok(attente >= 1 && attente <= 15, `attente : ${attente}`);
  ok("au-delà de la limite, l'adresse est bloquée pour la fenêtre");

  // Une autre adresse n'est pas touchée : un inconnu ne bloque pas le
  // propriétaire en échouant exprès.
  assert.equal(await lockedMinutes("198.51.100.1"), 0);
  ok("le blocage est propre à une adresse");

  // Des échecs hors de la fenêtre ne comptent plus.
  await query(
    `update login_failures set failed_at = now() - interval '16 minutes' where ip = $1`,
    [ip],
  );
  assert.equal(await lockedMinutes(ip), 0);
  ok("les échecs anciens ne comptent plus");

  await recordFailure(ip);
  await clearFailures(ip);
  assert.equal(
    (await query(`select 1 from login_failures where ip = $1`, [ip])).length,
    0,
  );
  ok("une connexion réussie efface les échecs");

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

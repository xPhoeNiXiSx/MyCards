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
  DATA_MIGRATIONS,
  lastMigrationRun,
  migrationLedger,
} from "../lib/data-migrations";
import { SCHEMA_STATEMENTS } from "../lib/schema";
import {
  bestGain,
  breakdown,
  editionBadges,
  editionLabel,
  gradeLabel,
  parseGrade,
  groupItems,
  itemLabel,
  createItem,
  markAsOwned,
  ownedCountsByCard,
  inScope,
  scopeOf,
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
import { defaultSelection, isPocketSerie, selectSeries } from "../lib/catalogue";
import { DEFAULT_SETTINGS, getSettings, saveSetting } from "../lib/settings";
import {
  buildChart,
  categoryBreakdown,
  matchesCheck,
  movers,
  pendingChecks,
} from "../lib/dashboard";
import { investedSeries, parisToday, recordSnapshot, valueSeries } from "../lib/history";
import { findByNumber, normalizeCardNumber, setIdOf } from "../lib/card-number";
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

  assert.deepEqual(editionBadges(brute), { grade: null, language: null, condition: null });
  assert.deepEqual(
    editionBadges({ language: "ja", condition: "nm", grader: "psa", grade: "10" }),
    // Gradée : la note remplace l'état, qui n'a plus de pastille.
    { grade: "PSA 10", language: "JP", condition: null },
  );
  assert.deepEqual(
    editionBadges({ language: "fr", condition: "ex", grader: null, grade: null }),
    { grade: null, language: null, condition: "EX" },
  );
  ok("pastilles : note, langue hors français, état hors gradée");

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

  // --- Numéro de carte --------------------------------------------------

  assert.equal(normalizeCardNumber("015/165"), "15");
  assert.equal(normalizeCardNumber(" 015 "), "15");
  assert.equal(normalizeCardNumber("15"), "15");
  assert.equal(normalizeCardNumber("tg05"), "TG5");
  assert.equal(normalizeCardNumber("SV045"), "SV45");
  assert.equal(normalizeCardNumber("100a"), "100A");
  ok("un numéro se lit avec ou sans zéros, avec ou sans total");

  const setCartes = [
    { id: "sv03-015", localId: "015" },
    { id: "sv03-150", localId: "150" },
    { id: "sv03-TG05", localId: "TG05" },
  ];
  assert.equal(findByNumber(setCartes, "15/197")?.id, "sv03-015");
  assert.equal(findByNumber(setCartes, "150")?.id, "sv03-150");
  assert.equal(findByNumber(setCartes, "tg5")?.id, "sv03-TG05");
  assert.equal(findByNumber(setCartes, "16"), undefined);
  assert.equal(findByNumber(setCartes, "  "), undefined);
  ok("la carte d'un set se retrouve par son numéro, et seulement elle");

  assert.equal(setIdOf("sv03-015"), "sv03");
  assert.equal(setIdOf("sv03.5-025"), "sv03.5");
  assert.equal(setIdOf("sansTiret"), null);
  ok("le set se déduit de l'identifiant de carte");

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

  // --- Historique ---------------------------------------------------------

  await query(`delete from items`);
  const base = { ...etb, manualValueCents: null, manualValueDate: null, imageUrl: null };
  await createItem({ ...base, quantity: 1, purchasePriceCents: 1000, purchaseDate: "2026-01-10" });
  await createItem({ ...base, quantity: 2, purchasePriceCents: 500, purchaseDate: "2026-03-05" });
  await createItem({ ...base, quantity: 1, purchasePriceCents: 300, purchaseDate: "2026-01-10" });
  // Sans date : compté au jour de sa saisie, aujourd'hui.
  await createItem({ ...base, quantity: 1, purchasePriceCents: 200, purchaseDate: null });
  // Un article visé n'a rien coûté.
  await createItem({ ...base, status: "wanted", purchasePriceCents: 9999, purchaseDate: "2026-02-01" });

  const today = parisToday();
  assert.deepEqual(await investedSeries(), [
    { day: "2026-01-10", cents: 1300 },
    { day: "2026-03-05", cents: 2300 },
    { day: today, cents: 2500 },
  ]);
  ok("l'investi cumulé se reconstitue depuis les dates d'achat");

  const releve = summarize(await valuate(await listItems()));
  await recordSnapshot(releve);
  await recordSnapshot({ ...releve, totalValueCents: 4242 });
  assert.deepEqual(await valueSeries(), [{ day: today, cents: 4242 }]);
  ok("un relevé par jour, le dernier de la journée fait foi");

  await query(
    `insert into value_snapshots (day, value_cents, purchase_cents, valued_purchase_cents, unvalued_count)
     values ('2026-09-01', 3000, 2500, 2500, 0)`,
  );
  assert.equal((await valueSeries())[0].day, "2026-09-01");
  ok("les relevés sont rendus dans l'ordre chronologique");

  // --- Possession par carte, pour le catalogue ------------------------------

  await createItem({ ...base, kind: "single", sealedType: null, cardId: "30th-025", quantity: 2 });
  await createItem({ ...base, kind: "single", sealedType: null, cardId: "30th-025", quantity: 1 });
  await createItem({ ...base, kind: "single", sealedType: null, cardId: "30th-015", quantity: 1 });
  // Visée, pas possédée : ne compte pas.
  await createItem({ ...base, status: "wanted", kind: "single", sealedType: null, cardId: "30th-015" });
  const possedees = await ownedCountsByCard();
  assert.equal(possedees["30th-025"], 3);
  assert.equal(possedees["30th-015"], 1);
  assert.equal(Object.keys(possedees).length, 2);
  ok("exemplaires possédés par carte, sans les articles visés");

  // --- Deux inventaires ------------------------------------------------------

  assert.equal(scopeOf("single"), "cards");
  assert.equal(scopeOf("sealed"), "sealed");
  // « Autre » n'est pas une carte : il rejoint le scellé.
  assert.equal(scopeOf("other"), "sealed");
  assert.equal(inScope({ kind: "single" }, "sealed"), false);
  ok("les cartes d'un côté, le scellé et le reste de l'autre");

  // --- Réglages ---------------------------------------------------------------

  assert.deepEqual(await getSettings(), DEFAULT_SETTINGS);
  ok("sans réglage enregistré, les valeurs par défaut s'appliquent");

  await saveSetting("hidePocket", false);
  await saveSetting("catalogueSets", ["sv03", "30th"]);
  assert.deepEqual(await getSettings(), { hidePocket: false, catalogueSets: ["sv03", "30th"] });
  await saveSetting("catalogueSets", ["me02"]);
  assert.deepEqual((await getSettings()).catalogueSets, ["me02"]);
  ok("les réglages s'enregistrent et se remplacent");

  await saveSetting("catalogueSets", null);
  assert.equal((await getSettings()).catalogueSets, null);
  ok("effacer la sélection revient au choix par défaut");

  // --- Extensions affichées --------------------------------------------------

  const catalogueTest = [
    { id: "me", name: "Méga-Évolution", sets: [{ id: "me01" }, { id: "me02" }] },
    { id: "tcgp", name: "Pokémon TCG Pocket", sets: [{ id: "A1" }] },
    { id: "sv", name: "Écarlate et Violet", sets: [{ id: "sv03" }, { id: "sv03.5" }] },
  ];
  assert.equal(isPocketSerie(catalogueTest[1]), true);
  assert.equal(isPocketSerie({ id: "autre", name: "Pokémon TCG Pocket" }), true);
  assert.equal(isPocketSerie(catalogueTest[0]), false);
  ok("la série Pocket est reconnue");

  assert.deepEqual(defaultSelection(catalogueTest, ["sv03.5-025", "me01-001"]), [
    "me01",
    "me02",
    "sv03.5",
  ]);
  assert.deepEqual(defaultSelection([], []), []);
  ok("par défaut : la série la plus récente et les extensions possédées");

  assert.deepEqual(
    selectSeries(catalogueTest, new Set(["me02", "sv03"])).map((serie) => [
      serie.id,
      serie.sets.map((set) => set.id),
    ]),
    [
      ["me", ["me02"]],
      ["sv", ["sv03"]],
    ],
  );
  ok("seules les extensions choisies, et leurs séries, sont gardées");

  // --- Courbe --------------------------------------------------------------

  const investi = [
    { day: "2026-01-10", cents: 1300 },
    { day: "2026-03-05", cents: 2300 },
    { day: "2026-09-20", cents: 2500 },
  ];
  const valeurs = [
    { day: "2026-09-10", cents: 2600 },
    { day: "2026-09-20", cents: 2900 },
    { day: "2026-09-23", cents: 3100 },
  ];

  const mois = buildChart(investi, valeurs, "30j", "2026-09-23");
  assert.equal(mois.start, "2026-08-25");
  // L'investi part de son niveau d'avant la période, et va jusqu'à aujourd'hui.
  assert.deepEqual(mois.invested, [
    { day: "2026-08-25", cents: 2300 },
    { day: "2026-09-20", cents: 2500 },
    { day: "2026-09-23", cents: 2500 },
  ]);
  assert.equal(mois.value.length, 3);
  assert.equal(mois.valueChange, 500);
  assert.equal(mois.min, 2300);
  assert.equal(mois.max, 3100);
  ok("courbe sur 30 jours : investi reporté, valeur et écart de la période");

  const semaine = buildChart(investi, valeurs, "7j", "2026-09-23");
  assert.equal(semaine.start, "2026-09-17");
  assert.deepEqual(semaine.value.map((point) => point.day), ["2026-09-20", "2026-09-23"]);
  ok("courbe sur 7 jours : seuls les relevés de la période");

  const tout = buildChart(investi, valeurs, "tout", "2026-09-23");
  assert.equal(tout.start, "2026-01-10");
  assert.equal(tout.invested[0].cents, 1300);
  ok("courbe complète : depuis le premier achat");

  const unSeul = buildChart(investi, [{ day: "2026-09-23", cents: 2500 }], "30j", "2026-09-23");
  assert.equal(unSeul.valueChange, null);
  ok("un seul relevé : pas d'écart annoncé");

  const plat = buildChart([], [{ day: "2026-09-23", cents: 2500 }], "7j", "2026-09-23");
  assert.ok(plat.max > plat.min);
  assert.deepEqual(plat.invested, []);
  ok("une courbe plate garde une hauteur");

  // --- Tableau de bord -------------------------------------------------------

  const lignes = await valuate([
    { ...base, id: "d1", kind: "single", sealedType: null, name: "A", purchasePriceCents: 1000, manualValueCents: 1500, manualValueDate: "2026-01-01" },
    { ...base, id: "d2", kind: "single", sealedType: null, name: "B", purchasePriceCents: 1000, manualValueCents: 800, manualValueDate: "2026-09-01" },
    { ...base, id: "d3", kind: "single", sealedType: null, name: "C", purchasePriceCents: 0, grader: "psa", grade: "10" },
    { ...base, id: "d4", name: "ETB", sealedType: "etb", purchasePriceCents: 4000, manualValueCents: 5000, manualValueDate: "2026-09-01" },
  ]);
  const [a, b, c, d] = lignes;

  assert.equal(matchesCheck(a, "cote-ancienne", "2026-09-23"), true);
  assert.equal(matchesCheck(b, "cote-ancienne", "2026-09-23"), false);
  assert.equal(matchesCheck(c, "sans-cote", "2026-09-23"), true);
  assert.equal(matchesCheck(c, "gradee", "2026-09-23"), true);
  assert.equal(matchesCheck(c, "sans-prix", "2026-09-23"), true);
  assert.equal(matchesCheck(d, "sans-cote", "2026-09-23"), false);
  assert.deepEqual(
    pendingChecks(lignes, "2026-09-23").map((check) => [check.key, check.count]),
    [["sans-cote", 1], ["gradee", 1], ["cote-ancienne", 1], ["sans-prix", 1]],
  );
  assert.deepEqual(pendingChecks([d], "2026-09-23"), []);
  ok("à vérifier : chaque règle, et rien quand tout va bien");

  const categories = categoryBreakdown(lignes);
  assert.deepEqual(categories.map((part) => [part.category, part.valueCents, part.share]), [
    ["etb", 10000, 68],
    ["single", 4600, 32],
  ]);
  ok("répartition par catégorie, triée par valeur");

  const mouvements = movers(groupItems(lignes));
  assert.deepEqual(mouvements.gains.map((group) => group.name), ["ETB", "A"]);
  assert.deepEqual(mouvements.losses.map((group) => group.name), ["B"]);
  ok("hausses et baisses : sans les lignes non cotées");

  // --- Migrations de données --------------------------------------------

  // Base neuve : les articles sont saisis *avant* la migration, comme dans la
  // vraie vie — sinon elle n'aurait rien à remplir et se marquerait jouée.
  await pg.close();
  const pgData = new PGlite();
  setQueryRunner(async (text, params = []) => {
    const result = await pgData.query(text, params as unknown[]);
    return result.rows as never[];
  });

  for (const statement of SCHEMA_STATEMENTS) {
    await query(statement);
  }

  assert.equal(await lastMigrationRun(query), null);
  ok("tant que rien n'a été appliqué, aucune date n'est affichée");

  const scelle: ItemInput = {
    status: "owned",
    kind: "sealed",
    sealedType: "etb",
    name: "ETB 30ans",
    cardId: null,
    setName: null,
    quantity: 1,
    purchasePriceCents: 5500,
    purchaseDate: null,
    manualValueCents: null,
    manualValueDate: null,
    imageUrl: null,
    notes: null,
    language: null,
    condition: null,
    grader: null,
    grade: null,
  };

  await createItem(scelle);
  // Casse différente : le nom est le seul point d'accroche, il doit être
  // comparé sans tenir compte des majuscules.
  await createItem({
    ...scelle,
    sealedType: "blister",
    name: "blister me05 NUIT NOIRE",
  });
  // Cote déjà saisie : la migration ne doit pas y toucher.
  await createItem({
    ...scelle,
    sealedType: "blister",
    name: "Blister ME04 Chaos Ascendant",
    manualValueCents: 1200,
    manualValueDate: "2026-09-01",
  });

  const report = await runMigrations();
  const quotes = report.find((row) => row.id === "2026-09-25-cotes-scelle");
  assert.ok(quotes);
  assert.equal(quotes.applied, true);
  assert.equal(quotes.rows, 2);
  ok("la migration de cotes remplit les valeurs vides");

  const posed = await listItems();
  const byName = (name: string) =>
    posed.find((item) => item.name.toLowerCase() === name.toLowerCase());

  assert.equal(byName("ETB 30ans")?.manualValueCents, 5999);
  assert.equal(byName("ETB 30ans")?.manualValueDate, "2026-09-25");
  assert.equal(byName("blister me05 nuit noire")?.manualValueCents, 699);
  ok("les cotes posées sont datées et indépendantes de la casse");

  assert.equal(byName("Blister ME04 Chaos Ascendant")?.manualValueCents, 1200);
  assert.equal(byName("Blister ME04 Chaos Ascendant")?.manualValueDate, "2026-09-01");
  ok("une cote déjà saisie n'est jamais écrasée");

  // Un relevé plus frais (un nouvel identifiant, donc une nouvelle migration)
  // rafraîchit ce qu'un relevé précédent avait posé, et laisse les saisies.
  const refresh = await DATA_MIGRATIONS[0].run(query);
  assert.equal(refresh, 2);
  const apres = await listItems();
  assert.equal(
    apres.find((item) => item.name === "Blister ME04 Chaos Ascendant")
      ?.manualValueCents,
    1200,
  );
  ok("un relevé plus frais rafraîchit les cotes posées, jamais les saisies");

  // Corriger une cote dans l'app la met hors d'atteinte des relevés suivants.
  const corrige = apres.find((item) => item.name === "ETB 30ans");
  assert.ok(corrige);
  await updateItem(corrige.id, {
    ...scelle,
    name: corrige.name,
    manualValueCents: 6990,
    manualValueDate: "2026-09-26",
  });
  assert.equal(await DATA_MIGRATIONS[0].run(query), 1);
  const garde = await listItems();
  assert.equal(
    garde.find((item) => item.name === "ETB 30ans")?.manualValueCents,
    6990,
  );
  ok("une cote corrigée dans l'app n'est plus touchée par les relevés");

  // Deuxième clic sur « Appliquer les migrations » : rien ne doit rebouger,
  // même si une valeur a été effacée entre-temps.
  await query(
    `update items set manual_value_cents = null where lower(name) = 'etb 30ans'`,
  );
  const again = await runMigrations();
  assert.equal(again.find((row) => row.id === "2026-09-25-cotes-scelle")?.applied, false);
  assert.equal(byName("ETB 30ans")?.name, "ETB 30ans");
  const rejoue = await listItems();
  assert.equal(
    rejoue.find((item) => item.name === "ETB 30ans")?.manualValueCents,
    null,
  );
  ok("une migration déjà jouée ne repart pas au clic suivant");

  // Le bouton doit pouvoir dire « appliquées le … » même quand toutes les
  // migrations avaient déjà été jouées et qu'il n'y avait rien à poser.
  const passage = await lastMigrationRun(query);
  assert.ok(passage instanceof Date);
  assert.ok(Date.now() - passage.getTime() < 60_000);
  ok("la date du dernier passage est enregistrée à chaque application");

  const ledger = await migrationLedger(query);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].id, "2026-09-25-cotes-scelle");
  assert.equal(Number(ledger[0].rows_touched), 2);
  ok("le registre garde la trace de ce qui a été posé");

  await pgData.close();

  console.log(checks.map((check) => `  ✓ ${check}`).join("\n"));
  console.log(`\n${checks.length} vérifications passées.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

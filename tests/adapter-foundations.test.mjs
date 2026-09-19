import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRegNumber } from "../scripts/lib/normalize-adapter.mjs";
import { matchesFamily, equipmentChecks, passesListingFilters, passesFamilyGate, isAllowedFuelType, matchesFamilyUrl, evaluateCandidate, classifyFuelType } from "../scripts/lib/filters.mjs";
import { buildPurchaseOffer } from "../scripts/lib/offer-schema.mjs";
import { parseUrlsetEntries, planIncrementalFetch } from "../scripts/lib/adapter-base.mjs";

test("sitemap parsing preserves canonical URLs and last-modified values", () => {
  const xml = "<urlset><url><loc>https://example.se/car?a=1&amp;b=2</loc><lastmod>2026-09-18</lastmod></url></urlset>";
  assert.deepEqual(parseUrlsetEntries(xml), [{ loc: "https://example.se/car?a=1&b=2", lastmod: "2026-09-18" }]);
});

test("incremental planning fetches new, changed and stale priority listings", () => {
  const now = new Date("2026-09-19T12:00:00Z");
  const entries = [
    { loc: "https://example.se/new", lastmod: "2" },
    { loc: "https://example.se/changed", lastmod: "2" },
    { loc: "https://example.se/priority", lastmod: "1" },
    { loc: "https://example.se/fresh", lastmod: "1" },
  ];
  const included = { quality: { selection: { included: true } } };
  const cached = {
    "https://example.se/changed": { lastmod: "1", lastFetchedAt: "2026-09-19T11:00:00Z" },
    "https://example.se/priority": { lastmod: "1", lastFetchedAt: "2026-09-18T20:00:00Z", offer: included },
    "https://example.se/fresh": { lastmod: "1", lastFetchedAt: "2026-09-19T11:00:00Z", offer: included },
  };
  const plan = planIncrementalFetch(entries, cached, { now, sampleModulo: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(plan.selected, ["https://example.se/new", "https://example.se/changed", "https://example.se/priority"]);
  assert.deepEqual(Object.values(plan.reasons), ["new", "changed", "priority-refresh"]);
});

test("normalizes registration numbers consistently (uppercase, no spaces or hyphens)", () => {
  assert.equal(normalizeRegNumber("abc123"), "ABC123");
  assert.equal(normalizeRegNumber("abc-123"), "ABC123");
  assert.equal(normalizeRegNumber(" ABC 123 "), "ABC123");
  assert.equal(normalizeRegNumber("ums 629"), "UMS629");
  assert.equal(normalizeRegNumber(null), null);
});

test("matches family models and rejects small cars", () => {
  assert.equal(matchesFamily("Skoda Octavia Kombi"), true);
  assert.equal(matchesFamily("Volkswagen Tiguan 2.0 TDI"), true);
  assert.equal(matchesFamily("Subaru Levorg 1.6 4WD"), true);
  assert.equal(matchesFamily("Skoda Kodiaq 2.0 TDI"), true);
  assert.equal(matchesFamily("Toyota Yaris"), false);
});

test("matchesFamilyUrl uses base model slugs, not body-type qualifiers", () => {
  assert.equal(matchesFamilyUrl("https://www.bilia.se/bilar/sok-bil/ford/focus/cym15h/"), true);
  assert.equal(matchesFamilyUrl("https://www.bilia.se/bilar/sok-bil/volvo/xc60/euf951/"), true);
  assert.equal(matchesFamilyUrl("https://www.bilia.se/bilar/sok-bil/bmw/x1/mnu92c/"), true);
  assert.equal(matchesFamilyUrl("https://www.bilia.se/bilar/sok-bil/toyota/yaris/yya535/"), false);
});

test("isAllowedFuelType rejects electric and plug-in hybrid", () => {
  assert.equal(isAllowedFuelType("Bensin"), true);
  assert.equal(isAllowedFuelType("Diesel"), true);
  assert.equal(isAllowedFuelType("Hybrid"), true);
  assert.equal(isAllowedFuelType("El"), false);
  assert.equal(isAllowedFuelType("Laddhybrid - Bensin"), false);
  assert.equal(isAllowedFuelType(""), true);
});

test("isAllowedFuelType keeps self-charging hybrids but rejects Recharge plug-ins", () => {
  assert.equal(isAllowedFuelType("Bensin+El"), true);
  assert.equal(isAllowedFuelType("Elhybrid - Bensin"), true);
  assert.equal(isAllowedFuelType("Hybrid el/bensin"), true);
  assert.equal(isAllowedFuelType("Mildhybrid"), true);
  assert.equal(isAllowedFuelType("Bensin+El", "Volvo XC40 T5 Recharge"), false);
  assert.equal(isAllowedFuelType("Laddhybrid - Bensin", "Volvo V60 Recharge"), false);
  assert.equal(isAllowedFuelType("", "Kia Ceed Sportswagon Plug-in Hybrid"), false);
});

test("ambiguous petrol-electric hybrids require verification and known PHEVs are rejected", () => {
  assert.equal(classifyFuelType("Bensin+El", "Peugeot 3008 HYBRID 225").allowed, false);
  assert.equal(classifyFuelType("Bensin+El", "Toyota Corolla Touring Sports").status, "verify");
  assert.equal(classifyFuelType("Hybrid", "Toyota RAV4 självladdande").status, "allowed");
});

test("equipmentChecks scans labels and marketing text", () => {
  const checks = equipmentChecks(["Antisladd", "ISOFIX-fästen bak"], "Parkeringssensorer och backkamera ingår");
  assert.equal(checks.antisladd, true);
  assert.equal(checks.isofix, true);
  assert.equal(checks.parking, true);
  assert.equal(checks.camera, true);
});

test("passesListingFilters honours price, year and mileage bounds", () => {
  assert.equal(passesListingFilters({ priceSek: 200000, modelYear: 2022, mileageMil: 4000 }), true);
  assert.equal(passesListingFilters({ priceSek: 300000, modelYear: 2022, mileageMil: 4000 }), false);
  assert.equal(passesListingFilters({ priceSek: 200000, modelYear: 2018, mileageMil: 4000 }), false);
  assert.equal(passesListingFilters({ priceSek: 95000, modelYear: 2020, mileageMil: 9000 }), true);
  assert.equal(passesListingFilters({ priceSek: 200000, modelYear: 2024, mileageMil: 4000 }), true);
  assert.equal(passesListingFilters({ priceSek: null, modelYear: null, mileageMil: null }), true);
});

test("candidate evaluation separates standard cars from soft exceptions", () => {
  const standard = evaluateCandidate({ title: "Skoda Octavia Kombi", priceSek: 200000, modelYear: 2022, mileageMil: 4000, fuelType: "Bensin", transmission: "Automat", bodyType: "Kombi" });
  assert.equal(standard.lane, "standard");
  const exception = evaluateCandidate({ title: "Skoda Octavia Kombi", priceSek: 110000, modelYear: 2020, mileageMil: 9000, fuelType: "Diesel", transmission: "Manuell", bodyType: "Kombi" });
  assert.equal(exception.included, true);
  assert.deepEqual(exception.exceptionReasons, ["årsmodell utanför normalspannet", "miltal över normaltaket 7 500 mil", "manuell växellåda"]);
});

test("passesFamilyGate combines family match with numeric bounds", () => {
  assert.equal(passesFamilyGate({ title: "Skoda Octavia", variant: "Kombi", priceSek: 200000, modelYear: 2022, mileageMil: 4000 }), true);
  assert.equal(passesFamilyGate({ title: "Skoda Octavia", variant: "Kombi", priceSek: 300000, modelYear: 2022, mileageMil: 4000 }), false);
});

test("buildPurchaseOffer emits the canonical offer shape with evidence and quality", () => {
  const offer = buildPurchaseOffer({
    id: "test:1", title: "Skoda Octavia Kombi", registrationNumber: "abc 123", priceSek: 200000,
    modelYear: 2022, mileageMil: 4000, fuelType: "Bensin", transmission: "Automat", bodyType: "Kombi",
    equipment: ["Antisladd", "ISOFIX", "Parkeringssensorer", "Backkamera"], sourceUrl: "https://example.se", sourceOwner: "Test", sourceCheckedAt: "2026-09-12T10:00:00Z",
  });
  assert.equal(offer.registrationNumber, "ABC123");
  assert.equal(offer.kind, "purchase");
  assert.equal(offer.lifecycle, "preliminary");
  assert.equal(offer.evidence.price.status, "verified");
  assert.equal(offer.evidence.identity.status, "observed");
  assert.equal(offer.evidence.economics.status, "missing");
  assert.equal(offer.quality.passesRequiredEquipment, true);
  assert.equal(offer.quality.rankable, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail, extractAdvertJson, discoverDetailUrls } from "../scripts/importers/riddermark.mjs";

const DETAIL_URL = "https://www.riddermarkbil.se/kopa-bil/kia/neg079/";

function fixtureHtml() {
  const advertJson = {
    licenseplate: "NEG079",
    vinNumber: "U5YHN813GDL020331",
    price: 124800,
    initialPrice: 129900,
    mileage: 10972,
    modelYear: 2013,
    fuelType: "Bensin",
    gearboxType: "Automatisk",
    carType: "Kombi",
    title: "Kia Ceed",
    carName: "Kia Ceed Kombi",
    location: { name: "Göteborg", slug: "goteborg" },
    publishedAt: "2026-09-01",
    images: [{ url: "https://img.example/1.jpg", originalImageUrl: "https://img.example/1-orig.jpg" }],
    equipment: ["Klimatanläggning"],
    sellingPoints: ["Full servicehistorik"],
    attributes: [
      { category: "Säkerhet", description: "Totalt: 5" },
      { category: "Säkerhet", description: "Antisladdsystem (ESC)" },
      { category: "Barn", description: "ISOFIX" },
    ],
    isSold: false,
  };
  const nextData = { props: { pageProps: { advertJson } } };
  const carLd = { "@type": "Car", mileageFromOdometer: { value: 109720, unitCode: "KMT" }, offers: { price: 124800 } };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script><script type="application/ld+json">${JSON.stringify(carLd)}</script>`;
}

test("finds only advert detail URLs in the Riddermark sitemap", () => {
  const xml = `<urlset><url><loc>https://www.riddermarkbil.se/kopa-bil/</loc></url><url><loc>${DETAIL_URL}</loc></url></urlset>`;
  assert.deepEqual(discoverDetailUrls(xml), [DETAIL_URL]);
});

test("uses advertJson mileage in mil, not the JSON-LD kilometer value", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "NEG079");
  assert.equal(result.vin, "U5YHN813GDL020331");
  assert.equal(result.priceSek, 124800);
  assert.equal(result.mileageMil, 10972);
  assert.equal(result.fuelType, "Bensin");
  assert.equal(result.bodyType, "Kombi");
  assert.equal(result.place, "Göteborg");
  assert.equal(result.requiredEquipment.antisladd, true);
  assert.equal(result.requiredEquipment.isofix, true);
});

test("throws a clear error when advertJson is missing", () => {
  assert.throws(() => extractAdvertJson('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>'), /advertJson/);
});

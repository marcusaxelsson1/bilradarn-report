import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail, extractCar, discoverDetailUrls, discoverDetailEntries, extractListPage, yearFromSlug } from "../scripts/importers/hedin.mjs";

const DETAIL_URL = "https://hedinautomotive.se/bilar/kop-bil/250314/pc-uc-volvo-v90-2022";

function fixtureHtml() {
  const car = {
    car_id: 250314,
    car_regno: "WFG509",
    car_chassino: "YV1PWK9VDN1180643",
    car_price: 329900,
    car_mileage: 7400,
    car_odometer: 74000,
    car_year: 2022,
    car_fuel: "Bensin",
    car_gearbox: "Automatisk",
    car_body: "Kombi",
    car_color: "Blå",
    car_model_text: "Volvo V90 2022 Bensin",
    car_version: "B4 Momentum",
    car_equipment: ["Antisladd (ESC)", "ISOFIX-fästen bak", "Parkeringssensorer", "360° kamera"],
    car_images: [{ thumbnail_url: "https://img.example/1.jpg", original: "https://img.example/1-orig.jpg" }],
    car_sellers: [{ name: "Hedin Automotive Alingsås Öst" }],
    car_site_city: "Alingsås",
    car_condition: "Begagnad",
    car_is_used: true,
  };
  const nextData = { props: { pageProps: { componentProps: { "some-guid": { car } } } } };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
}

test("finds only car detail URLs in a Hedin sitemap", () => {
  const xml = `<urlset><url><loc>https://hedinautomotive.se/bilar/kop-bil/begagnade-bilar-i-lager</loc></url><url><loc>${DETAIL_URL}</loc><lastmod>2026-09-18</lastmod></url></urlset>`;
  assert.deepEqual(discoverDetailUrls(xml), [DETAIL_URL]);
  assert.deepEqual(discoverDetailEntries(xml), [{ loc: DETAIL_URL, lastmod: "2026-09-18" }]);
  assert.equal(yearFromSlug(DETAIL_URL), 2022);
});

test("reads Hedins server-rendered public list page", () => {
  const page = { total_items: 1, content: [{ car_id: 250314, slug: "pc-uc-volvo-v90-2022" }] };
  const nextData = {
    props: {
      pageProps: {
        componentProps: {
          search: {
            dehydratedState: {
              queries: [{ state: { data: { pages: [page] } } }],
            },
          },
        },
      },
    },
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
  assert.deepEqual(extractListPage(html), page);
});

test("normalizes the car object found under the Sitecore component guid", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "WFG509");
  assert.equal(result.vin, "YV1PWK9VDN1180643");
  assert.equal(result.priceSek, 329900);
  assert.equal(result.mileageMil, 7400);
  assert.equal(result.modelYear, 2022);
  assert.equal(result.fuelType, "Bensin");
  assert.equal(result.bodyType, "Kombi");
  assert.equal(result.dealer, "Hedin Automotive Alingsås Öst");
  assert.equal(result.imageUrls.length, 1);
  assert.equal(result.quality.passesRequiredEquipment, true);
});

test("throws a clear error when the car object is absent", () => {
  assert.throws(() => extractCar('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"componentProps":{}}}}</script>'), /car-objekt/);
});

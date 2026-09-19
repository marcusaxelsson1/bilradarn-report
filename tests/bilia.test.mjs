import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../scripts/lib/adapter-base.mjs";
import { normalizeDetail, regNumberFromSlug, discoverDetailUrls, discoverDetailEntries } from "../scripts/importers/bilia.mjs";

const DETAIL_URL = "https://www.bilia.se/bilar/sok-bil/volkswagen/tiguan/ums629/";

function fixtureHtml() {
  const car = {
    "@type": "Car",
    name: "Volkswagen Tiguan 2.0 TDI DPF SCR 4Motion",
    brand: { name: "Volkswagen" },
    model: "Tiguan",
    color: "Svart",
    bodyType: "SUV",
    mileageFromOdometer: { value: 129500, unitCode: "KMT" },
    vehicleModelDate: "2018",
    vehicleTransmission: "Automat",
    vehicleIdentificationNumber: "WVGZZZ5NZJW936382",
    vehicleEngine: { fuelType: "Diesel" },
    offers: { price: 229900, availability: "https://schema.org/InStock", seller: { name: "Bilia Outlet" } },
    image: ["https://cdn.bilia.se/car.jpg"],
  };
  const webPage = {
    "@type": "WebPage",
    description: "<p>Säljartext</p><ul><li>Antisladdsystem</li><li>ISOFIX-fästen bak</li><li>Parkeringssensorer</li><li>Backkamera</li></ul>",
  };
  return `<script type="application/ld+json">${JSON.stringify(car)}</script><script type="application/ld+json">${JSON.stringify(webPage)}</script>`;
}

test("reads the registration number from the lowercase URL slug", () => {
  assert.equal(regNumberFromSlug(DETAIL_URL), "UMS629");
});

test("finds only detail URLs in a Bilia sitemap", () => {
  const xml = `<urlset><url><loc>https://www.bilia.se/bilar/sok-bil/begagnade-bilar/</loc></url><url><loc>https://www.bilia.se/bilar/sok-bil/volkswagen/tiguan/ums629/</loc><lastmod>2026-09-18</lastmod></url></urlset>`;
  assert.deepEqual(discoverDetailUrls(xml), [DETAIL_URL]);
  assert.deepEqual(discoverDetailEntries(xml), [{ loc: DETAIL_URL, lastmod: "2026-09-18" }]);
});

test("normalizes Bilia JSON-LD into the canonical offer", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "UMS629");
  assert.equal(result.vin, "WVGZZZ5NZJW936382");
  assert.equal(result.priceSek, 229900);
  assert.equal(result.mileageMil, 12950);
  assert.equal(result.fuelType, "Diesel");
  assert.equal(result.bodyType, "SUV");
  assert.equal(result.modelYear, 2018);
  assert.equal(result.quality.passesRequiredEquipment, true);
});

test("HTTP errors retain status so removed listings can be classified", () => {
  const error = new HttpError(410, DETAIL_URL);
  assert.equal(error.status, 410);
  assert.equal(error.url, DETAIL_URL);
});

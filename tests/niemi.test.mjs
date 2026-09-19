import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail, extractListCars } from "../scripts/importers/niemi.mjs";

const DETAIL_URL = "https://www.niemibil.se/objekt/volvo-v90-d4-awd-geartronic-momentum/";

function fixtureHtml() {
  const facts = [
    ["Registreringsnummer", "FNH765"], ["VIN", "YV1PWA8UCK1097107"], ["Mätarställning", "9 637 mil"],
    ["Drivmedel", "Diesel"], ["Växellåda", "Automatisk"], ["Kaross", "Kombi"], ["Modellår", "2019"],
  ].map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  const equipment = ["Antisladd", "Autobroms", "ISOFIX-fästen bak", "Backkamera", "Parkeringssensorer"]
    .map((item) => `<li><span>${item}</span></li>`).join("");
  const gallery = JSON.stringify([{ src: "https://www.niemibil.se/wp-content/uploads/1.jpg", thumb: "https://www.niemibil.se/wp-content/uploads/1t.jpg" }]);
  return `<meta property="og:rule_title" content="Volvo V90, 2019">
<meta property="og:rule_price" content="279 900 kr">
<dl>${facts}</dl>
<ul class="columns-2 lg:columns-3">${equipment}</ul>
<script type="application/json" data-gallery-images>${gallery}</script>`;
}

test("parses Niemi HTML facts without JSON-LD", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.title, "Volvo V90, 2019");
  assert.equal(result.registrationNumber, "FNH765");
  assert.equal(result.vin, "YV1PWA8UCK1097107");
  assert.equal(result.mileageMil, 9637);
  assert.equal(result.priceSek, 279900);
  assert.equal(result.fuelType, "Diesel");
  assert.equal(result.bodyType, "Kombi");
  assert.equal(result.modelYear, 2019);
  assert.equal(result.imageUrls.length, 1);
  assert.equal(result.quality.passesRequiredEquipment, true);
});

test("reads reg.nr and price from a Niemi listing card", () => {
  const html = '<article id="car-2663286" class="builder-reset car-item car-item-id-2663286" data-regno="UYO964" data-price="189900" data-wp-id="2663286"><meta itemprop="description" content="Skoda Octavia Kombi, 2022, 5 096 mil, Bensin"><a href="/objekt/skoda-octavia/"></a></article>';
  const cars = extractListCars(html);
  assert.equal(cars.length, 1);
  assert.equal(cars[0].regNo, "UYO964");
  assert.equal(cars[0].price, 189900);
  assert.equal(cars[0].title, "Skoda Octavia Kombi");
  assert.equal(cars[0].modelYear, 2022);
  assert.equal(cars[0].mileageMil, 5096);
  assert.equal(cars[0].fuelType, "Bensin");
});

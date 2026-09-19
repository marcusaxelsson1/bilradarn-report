import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail, extractCar, normalizeListCard } from "../scripts/importers/dinbil.mjs";

const DETAIL_URL = "https://dinbil.se/bilar-i-lager/begagnat/mlp48s";

function fixtureHtml() {
  const car = {
    regNumber: "MLP48S",
    chassiNumber: "WVGZZZCSZPY022713",
    pricePoints: { actualCost: 224900, cost: 224900 },
    mileage: 4523,
    modelYear: 2023,
    fuelType: "Bensin",
    gearType: "Automat",
    bodyType: "suv",
    color: "Svart",
    make: "Volkswagen",
    model: "Tiguan",
    factoryEquipment: [{ code: "KA1", text: "backkamera rear assist" }],
    equipment: ["R Line", "Keyless access"],
    searchString: "Antisladd, Isofix, Parkeringssensorer fram & bak, Front Assist, Lane Assist, backkamera",
    images: ["https://pics.vwgroup.se/prod/MLP48S/MLP48S.jpg"],
    dinBilRetailerName: "Din Bil / Volkswagen Kista",
    facility: { name: "Kista" },
    tax: 866,
    malus: 6898,
    consumption_wltp: "5.9 l/100km",
  };
  const nextData = { props: { pageProps: { car } } };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
}

test("normalizes Din Bil __NEXT_DATA__ car payload", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "MLP48S");
  assert.equal(result.vin, "WVGZZZCSZPY022713");
  assert.equal(result.priceSek, 224900);
  assert.equal(result.mileageMil, 4523);
  assert.equal(result.modelYear, 2023);
  assert.equal(result.fuelType, "Bensin");
  assert.equal(result.bodyType, "SUV");
  assert.equal(result.consumptionL100Km, 5.9);
  assert.equal(result.annualTaxSek, 866);
  assert.equal(result.dealer, "Din Bil / Volkswagen Kista");
  assert.equal(result.quality.passesRequiredEquipment, true);
});

test("throws a clear error when the car object is absent", () => {
  assert.throws(() => extractCar('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>'), /car-objekt/);
});

test("normalizes a browser-rendered Din Bil list card", () => {
  const result = normalizeListCard({
    reg: "pmt34m",
    title: "Volkswagen T-Roc",
    variant: "Life 1.5 TSI",
    location: "Din Bil / Volkswagen Kista",
    tags: ["2023", "Bensin", "Automat", "2 510 mil"],
    price: "224 900 kr",
    image: "https://pics.vwgroup.se/prod/PMT34M/PMT34M.jpg",
  }, "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "PMT34M");
  assert.equal(result.priceSek, 224900);
  assert.equal(result.modelYear, 2023);
  assert.equal(result.mileageMil, 2510);
  assert.equal(result.fuelType, "Bensin");
  assert.equal(result.transmission, "Automat");
  assert.equal(result.dealer, "Din Bil");
  assert.equal(result.place, "Volkswagen Kista");
  assert.equal(result.imageUrls.length, 1);
});

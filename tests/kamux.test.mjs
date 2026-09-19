import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDetail, extractVehicle, mapBodyType, mapFuelType } from "../scripts/importers/kamux.mjs";

const DETAIL_URL = "https://www.kamux.se/cars/audi/a6/DAC46P";

function fixtureHtml() {
  const vehicle = {
    id: "ac6f21a6-69f8-4c11-b817-6cd77406b111",
    regNo: "DAC46P",
    vehicleIdentificationNumber: "WAUZZZF2XLN035451",
    price: 269900,
    mileage: 117900,
    modelYear: 2020,
    fuelTypeCode: "BN",
    gearType: "automatic",
    bodyType: "Lim",
    equipment: ["ISOFIX", "ESC"],
    photos: ["https://res.cloudinary.com/kamux/image/upload/prod_v2/1460336/x.jpg"],
  };
  const jsonLd = {
    "@type": "Car",
    name: "Audi A6",
    manufacturer: { name: "Audi" },
    model: "A6",
    fuelType: "Petrol",
    bodyType: "Lim",
    vehicleTransmission: "automatic",
    offers: { price: 269900 },
  };
  const nextData = { props: { pageProps: vehicle } };
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`;
}

test("maps raw Kamux codes to canonical body and fuel values", () => {
  assert.equal(mapBodyType("Lim"), "Sedan");
  assert.equal(mapBodyType("SUV"), "SUV");
  assert.equal(mapFuelType("BN"), "Bensin");
  assert.equal(mapFuelType("DS"), "Diesel");
  assert.equal(mapFuelType("D"), "Diesel");
  assert.equal(mapFuelType("25"), "Hybrid");
});

test("normalizes Kamux detail payload and raw codes", () => {
  const result = normalizeDetail(DETAIL_URL, fixtureHtml(), "2026-09-12T10:00:00Z");
  assert.equal(result.registrationNumber, "DAC46P");
  assert.equal(result.vin, "WAUZZZF2XLN035451");
  assert.equal(result.priceSek, 269900);
  assert.equal(result.mileageMil, 11790);
  assert.equal(result.fuelType, "Bensin");
  assert.equal(result.transmission, "Automat");
  assert.equal(result.bodyType, "Sedan");
  assert.equal(result.requiredEquipment.antisladd, true);
  assert.equal(result.requiredEquipment.isofix, true);
});

test("throws a clear error when the vehicle payload is absent", () => {
  assert.throws(() => extractVehicle('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>'), /fordonsdata/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { extractSearchDocuments, normalizeDetail } from "../scripts/import-wayke.mjs";

test("extracts Wayke search documents from the published query payload", () => {
  const html = '<script>window["__RQ_R_lb_"] = [];</script><script>window["__RQ_R_lb_"].push({"queries":[{"queryKey":["vehicles","?hits=24"],"state":{"data":{"documentList":{"numberOfHits":1,"documents":[{"_id":"abc","title":"Kia Ceed Sportswagon"}]}}}}]});</script>';
  const result = extractSearchDocuments(html);
  assert.equal(result.totalHits, 1);
  assert.equal(result.documents[0]._id, "abc");
});

test("extracts Wayke search documents from the current search-ads payload", () => {
  const payload = {
    queries: [{
      queryKey: ["search-ads", "wayke", "page=1"],
      state: { data: { found: 1, hits: [{
        ad: {
          id: "new-id",
          branch: { city: "Göteborg", displayName: "Handlaren" },
          pricing: { cash: { price: { amount: "219000", currency: "SEK" } } },
          salesDescription: { title: "Kia Ceed Sportswagon Advance" },
        },
        iteration: {
          item: {
            displayName: "Kia Ceed Sportswagon",
            modelYear: { intValue: 2022 },
            driveline: { fuelTypesString: { stringValue: "Bensin" } },
            attributes: { transmission: { formattedValue: "Automat" } },
          },
          logistics: { odometerReading: { unit: "SCANDINAVIAN_MILE", value: 4180 } },
        },
      }] } },
    }],
  };
  const html = `<script>window["__RQ_R_lb_"] = [];</script><script>window["__RQ_R_lb_"].push(${JSON.stringify(payload)});</script>`;
  const result = extractSearchDocuments(html);
  assert.equal(result.totalHits, 1);
  assert.deepEqual(result.documents[0], {
    _id: "new-id",
    title: "Kia Ceed Sportswagon",
    shortDescription: "Kia Ceed Sportswagon Advance",
    modelYear: 2022,
    price: 219000,
    mileage: 4180,
    fuelType: "Bensin",
    gearboxType: "Automat",
    branches: [{ name: "Handlaren" }],
    position: { city: "Göteborg" },
  });
});

test("normalizes detail evidence without making the offer rankable", () => {
  const car = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: "Kia Ceed Sportswagon",
    url: "https://www.wayke.se/objekt/abc",
    identifier: { value: "ABC123" },
    offers: { price: 219900, availability: "https://schema.org/InStock", seller: { name: "Bilhandlaren" } },
    vehicleModelDate: "2022",
    vehicleTransmission: "Automat",
    bodyType: "Kombi",
    fuelConsumption: { value: 6.1 },
  };
  const pairs = [
    ["Antisladdsystem", "Ja"], ["Barnstol ISOFIX bak", "Ja"], ["Parkeringssensorer bak", "Ja"],
    ["Backkamera", "Ja"], ["Årlig fordonsskatt", "1 130 kr/år"],
  ].map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("");
  const html = `<script type="application/ld+json">${JSON.stringify(car)}</script>${pairs}`;
  const result = normalizeDetail({ _id: "abc", mileage: 4180, fuelType: "Bensin", distance: 9, position: { city: "Göteborg" } }, html, "2026-09-05T12:00:00Z");
  assert.equal(result.registrationNumber, "ABC123");
  assert.equal(result.annualTaxSek, 1130);
  assert.equal(result.consumptionL100Km, 6.1);
  assert.equal(result.quality.passesRequiredEquipment, true);
  assert.equal(result.quality.rankable, false);
});

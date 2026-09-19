import test from "node:test";
import assert from "node:assert/strict";
import { resolveTravelDistance, travelDistanceBand } from "../src/features/ranking/travelDistance.js";

test("uses a real positive source distance when one exists", () => {
  assert.deepEqual(resolveTravelDistance({ place: "Göteborg", distanceKm: 72 }), { km: 72, approximate: false });
});

test("replaces a bogus zero distance with an approximate place distance", () => {
  assert.deepEqual(resolveTravelDistance({ place: "Jönköping", distanceKm: 0 }), { km: 145, approximate: true });
});

test("finds a city in a dealer location and classifies both nearby bands", () => {
  const close = resolveTravelDistance({ dealer: "Bilbolaget i Kungälv" });
  const dayTrip = resolveTravelDistance({ place: "Halmstad" });
  assert.equal(travelDistanceBand(close).className, "near-10");
  assert.equal(travelDistanceBand(dayTrip).className, "near-15");
});

test("does not badge cars beyond 15 mil or cars with an unknown place", () => {
  assert.equal(travelDistanceBand(resolveTravelDistance({ place: "Värnamo" })), null);
  assert.equal(resolveTravelDistance({ place: "Okänd ort" }), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { offerBrand, parseHedvigMonthly, parseMekonomenSwap, tyreSearchUrl } from "../scripts/lib/cost-source-adapters.mjs";

test("reads Hedvig brand benchmark", () => {
  assert.equal(offerBrand("SEAT Leon Sportstourer"), "Seat");
  assert.equal(parseHedvigMonthly("<table><tr><td>Seat</td><td>508 kr</td></tr></table>", "Seat"), 508);
});

test("uses Västra Götaland full insurance as fallback", () => {
  assert.equal(parseHedvigMonthly("Västra Götaland | 257 kr | 356 kr | 578 kr", null), 578);
});

test("reads Mekonomen minimum swap price", () => {
  assert.equal(parseMekonomenSwap("<h3>Från 249 kr</h3>"), 249);
});

test("builds Däckonline search from registry dimension", () => {
  assert.equal(tyreSearchUrl("205/55 R16 91V"), "https://www.dackonline.se/search?width=205&profile=55&size=16&searchByCar=true");
  assert.equal(tyreSearchUrl(null), null);
});

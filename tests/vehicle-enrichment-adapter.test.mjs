import test from "node:test";
import assert from "node:assert/strict";
import { applyEnrichment, createEnrichmentRequest, normalizeRegistration, normalizeVin, validateEnrichmentFinding } from "../scripts/lib/vehicle-enrichment-adapter.mjs";

test("normalizes identifiers without accepting an invalid VIN", () => {
  assert.equal(normalizeRegistration("abc 123"), "ABC123");
  assert.equal(normalizeVin("WVWZZZ1JZXW000001"), "WVWZZZ1JZXW000001");
  assert.equal(normalizeVin("not-a-vin"), null);
});

test("creates a provider-neutral request with registry and quote boundaries", () => {
  const request = createEnrichmentRequest({ id: "x", registrationNumber: "abc123", vin: "WVWZZZ1JZXW000001", sourceUrl: "https://example.test/ad" });
  assert.equal(request.registrationNumber, "ABC123");
  assert.deepEqual(request.providers.registry.required, ["annualTaxSek", "co2Gkm", "firstTrafficDate"]);
  assert.ok(request.providers.insurance.required.includes("personalQuote"));
});

test("validates findings and applies only explicitly supplied numeric costs", () => {
  const finding = { offerId: "x", sourceUrl: "https://example.test/ad", checkedAt: "2026-09-08T00:00:00Z", costs: { tax: { amountSek: 1200, status: "verified", sourceUrl: "https://example.test/tax" }, insurance: { status: "unknown" } }, evidence: { tax: { status: "verified", sourceUrl: "https://example.test/tax" } } };
  assert.equal(validateEnrichmentFinding(finding), true);
  const offer = { id: "x", economics: { breakdown: [{ key: "tax", amountSek: 900, evidence: { status: "estimated" } }, { key: "insurance", amountSek: 700 }] } };
  assert.equal(applyEnrichment(offer, finding).economics.breakdown[0].amountSek, 1200);
  assert.equal(applyEnrichment(offer, finding).economics.breakdown[1].amountSek, 700);
});

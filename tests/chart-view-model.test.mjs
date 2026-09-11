import test from "node:test";
import assert from "node:assert/strict";
import { cashflowSeries, valueDebtSeries } from "../src/features/charts/chartViewModel.js";
import { buildTimelineEvents, groupTimelineEvents } from "../src/features/charts/timelineEvents.js";

const purchase = { kind: "buy", priceSek: 200000, economics: { loanPrincipalSek: 160000, residual36Sek: 120000, monthlyPlan: [{ month: 0, totalSek: 20000 }, { month: 1, totalSek: 5000 }] } };
const lease = { kind: "lease", priceSek: 0, economics: { loanPrincipalSek: 0, residual36Sek: 0, monthlyPlan: [{ month: 1, totalSek: 3000 }] } };

test("chart view-model keeps lease horizon and purchase value/debt semantics", () => {
  const cash = cashflowSeries([purchase, lease]);
  assert.equal(cash[0][0], 20000);
  assert.equal(cash[1][37], 0);
  const series = valueDebtSeries([purchase]);
  assert.equal(series.values[0][0], 200000);
  assert.equal(series.values[0][36], 120000);
  assert.equal(series.debts[0][36], 0);
});

test("timeline keeps only future verified milestones within the chart", () => {
  const offer = { mileageMil: 4798, reliability: { warranty: { durationMonths: 84, maxMileageMil: 15000, sourceUrl: "https://example.com/warranty" }, vehicleDamageWarranty: { durationMonths: 36 } }, maintenance: { service: { nextDue: { value: "2027-09-10", status: "verified" } } } };
  const registry = { firstTrafficDate: "2021-01-27", inspection: { validUntil: "2027-03-31" }, evidence: { sourceUrl: "https://example.com/registry" } };
  const events = buildTimelineEvents(offer, registry, "2026-09-10", 1500);
  assert.deepEqual(events.map((event) => event.type), ["inspection", "service", "newWarranty", "inspection", "inspection", "inspection"]);
  assert.ok(events.every((event) => event.month > 0 && event.month <= 60));
  assert.equal(events.some((event) => event.type === "vehicleDamage"), false);
  assert.deepEqual(events.filter((event) => event.type === "inspection").map((event) => event.date), ["2027-03-31", "2028-05-31", "2029-07-31", "2030-09-30"]);
  assert.equal(events.filter((event) => event.type === "inspection")[1].status, "estimated");
  assert.deepEqual(events.filter((event) => event.type === "inspection").map((event) => event.month), [7, 21, 35, 49]);
});

test("timeline groups multiple milestones into one marker", () => {
  const grouped = groupTimelineEvents([{ month: 12, type: "service" }, { month: 12, type: "inspection" }]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].items.length, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(new URL("../src/data/report.json", import.meta.url), "utf8"));
const sum = (rows) => Math.round(rows.reduce((total, row) => total + row.amountSek, 0));

test("report is live-only and contains no electric drivetrains", () => {
  assert.equal(report.mode, "live");
  assert.ok(report.purchases.length > 0);
  assert.ok(report.leases.length > 0);
  for (const offer of [...report.purchases, ...report.leases]) assert.doesNotMatch(`${offer.title} ${offer.variant} ${offer.fuelType}`, /electric|elbil|plug-in|laddhybrid/i);
});

test("every ranked offer reconciles breakdown and monthly horizon", () => {
  for (const offer of [...report.purchases, ...report.leases]) {
    assert.equal(sum(offer.economics.breakdown), offer.economics.total36Sek, offer.title);
    assert.equal(offer.economics.monthlyPlan.length, offer.kind === "buy" ? 61 : 37, offer.title);
    assert.ok(offer.economics.monthlyEconomicSek > 0);
    assert.ok(offer.economics.stressTotal36Sek >= offer.economics.total36Sek);
  }
});

test("purchase ranking has the required source and equipment evidence", () => {
  for (const offer of report.purchases) {
    assert.equal(offer.quality.rankable, true);
    assert.equal(offer.quality.rankBlockers.length, 0);
    assert.ok(offer.sourceUrl.startsWith("https://"));
    assert.equal(offer.quality.rankBlockers.length, 0);
  }
});

test("every visible offer has a sourced reliability summary", () => {
  for (const offer of [...report.purchases, ...report.leases]) {
    assert.ok(offer.reliability?.summary, `${offer.title} saknar driftsäkerhetstext`);
    assert.ok(offer.reliability?.sources?.length, `${offer.title} saknar driftsäkerhetskälla`);
    for (const source of offer.reliability.sources) assert.match(source.url, /^https?:\/\//);
  }
});

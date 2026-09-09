import test from "node:test";
import assert from "node:assert/strict";
import { cashflowSeries, valueDebtSeries } from "../src/features/charts/chartViewModel.js";

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

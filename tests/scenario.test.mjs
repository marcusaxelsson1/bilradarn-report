import test from "node:test";
import assert from "node:assert/strict";
import { applyScenario } from "../src/features/economics/scenario.js";

const offer = { economics: { breakdown: [{ key: "fuel", amountSek: 1000 }, { key: "insurance", amountSek: 1000 }, { key: "interest", amountSek: 1000 }, { key: "repair", amountSek: 1000 }], total36Sek: 4000, monthlyPlan: [{ month: 1, items: [{ label: "Bränsle", amountSek: 100 }, { label: "Försäkring", amountSek: 100 }], totalSek: 200 }] } };
test("personal scenario scales variable rows and monthly cashflow consistently", () => { const scenario = { annualMileageMil: 3000, fuelPriceSekPerLitre: 20, loanRatePercent: 3.095, insuranceLevel: "halv" }; const result = applyScenario(offer, scenario, 10); const repeated = applyScenario(result, scenario, 10); assert.ok(result.economics.total36Sek > 0); assert.equal(result.economics.monthlyEconomicSek, Math.round(result.economics.total36Sek / 36)); assert.equal(repeated.economics.total36Sek, result.economics.total36Sek); assert.ok(result.economics.monthlyPlan[0].totalSek !== 200); });

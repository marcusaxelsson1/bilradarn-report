import readline from "node:readline";
import {
  calculateLease,
  calculatePurchase,
  extraMileageCosts,
  formatResult,
  invariantSummary,
  longTermPurchaseProjection,
} from "./model.mjs";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";
let scenario = "base";
let downPaymentRate = 0.20;

const money = (value) => `${Math.round(value).toLocaleString("sv-SE")} kr`;
const mark = (ok) => (ok ? "OK" : "FEL");

function render(clear = true) {
  if (clear) console.clear();
  const purchase = calculatePurchase(scenario, downPaymentRate);
  const lease = calculateLease(scenario);
  const purchaseChecks = invariantSummary(purchase);
  const leaseChecks = invariantSummary(lease);
  console.log(`${bold}PROTOTYP — Bilradarns kalkylmotor${reset}`);
  console.log(`${dim}Exempelvärden, 36 månader, 1 500 mil/år. Inte verkliga erbjudanden.${reset}\n`);
  console.log(`${bold}Scenario${reset}: ${scenario}   ${bold}Kontantinsats köp${reset}: ${downPaymentRate * 100}%\n`);
  console.log(`${bold}                         KÖP              LEASING${reset}`);
  console.log(`Ekonomisk kostnad      ${money(purchase.economicCost).padEnd(17)} ${money(lease.economicCost)}`);
  console.log(`Genomsnitt/månad       ${money(purchase.averageMonthlyCost).padEnd(17)} ${money(lease.averageMonthlyCost)}`);
  console.log(`Utbetalningar          ${money(purchase.cashOut).padEnd(17)} ${money(lease.cashOut)}`);
  console.log(`Faktiska inbetalningar ${money(purchase.cashIn).padEnd(17)} ${money(lease.cashIn)}`);
  console.log(`Nettokassaflöde        ${money(purchase.netCashFlow).padEnd(17)} ${money(lease.netCashFlow)}`);
  console.log(`Tillgångsvärde mån 36  ${money(purchase.assetValueAt36).padEnd(17)} ${money(lease.assetValueAt36)}`);
  console.log(`Kapitalets alt.kostnad ${money(purchase.opportunityCost).padEnd(17)} ${money(lease.opportunityCost)}`);
  console.log(`Avstämningsdifferens   ${money(purchase.reconciliationDifference).padEnd(17)} ${money(lease.reconciliationDifference)}\n`);
  console.log(`${bold}Automatiska spärrar${reset}`);
  console.log(`Kassaflöde − tillgång + kapital = kostnad  köp ${mark(purchaseChecks.reconciles)} / leasing ${mark(leaseChecks.reconciles)}`);
  console.log(`Lånet är noll efter månad 36      ${mark(purchaseChecks.debtCleared)}`);
  console.log(`Deposition räknas inte som kostnad ${mark(leaseChecks.depositExcludedFromCost)}`);
  console.log(`Sparbuffert räknas inte som kostnad köp ${mark(purchaseChecks.repairSavingsExcludedFromCost)} / leasing ${mark(leaseChecks.repairSavingsExcludedFromCost)}\n`);
  console.log(`${bold}Separat extramilskänslighet, tre år${reset}`);
  for (const extra of [100, 300, 500].map(extraMileageCosts)) {
    console.log(`+${extra.annualExtraMil} mil/år: köp ${money(extra.purchase)}, leasing ${money(extra.lease)}`);
  }
  console.log(`\n${bold}Långtidsvy köp${reset}`);
  console.log("År  värdeintervall           skuld        drift bas / stress");
  for (const row of longTermPurchaseProjection()) {
    console.log(
      `${String(row.year).padStart(2)}  ${`${money(row.valueLow)}–${money(row.valueHigh)}`.padEnd(23)} ` +
      `${money(row.debt).padEnd(12)} ${money(row.operatingCost)} / ${money(row.operatingStress)}`,
    );
  }
  console.log(`\n${bold}Kommandon${reset}: [s] grund/stress  [k] 20%/0% kontantinsats  [j] JSON  [q] avsluta`);
}

function dispatch(key) {
  if (key === "s") scenario = scenario === "base" ? "stress" : "base";
  if (key === "k") downPaymentRate = downPaymentRate === 0.20 ? 0 : 0.20;
  if (key === "j") {
    console.log(JSON.stringify({
      purchase: formatResult(calculatePurchase(scenario, downPaymentRate)),
      lease: formatResult(calculateLease(scenario)),
      extraMileage: [100, 300, 500].map(extraMileageCosts),
    }, null, 2));
  }
}

if (process.argv.includes("--demo")) {
  render(false);
  scenario = "stress";
  downPaymentRate = 0;
  console.log(`\n${dim}Efter växling till stress och 0% kontantinsats${reset}\n`);
  render(false);
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt() {
  render();
  rl.question("> ", (answer) => {
    const key = answer.trim().toLowerCase()[0];
    if (key === "q") return rl.close();
    dispatch(key);
    prompt();
  });
}
prompt();

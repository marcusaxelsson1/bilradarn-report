const MONTHS = 36;

const sum = (values) => values.reduce((total, value) => total + value, 0);
const round = (value) => Math.round(value);

export function annuitySchedule({ principal, annualRate, months = MONTHS, setupFee = 0, monthlyFee = 0 }) {
  const monthlyRate = annualRate / 12;
  const principalPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate / (1 - (1 + monthlyRate) ** -months);
  let balance = principal;
  const rows = [];

  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate;
    const amortization = month === months ? balance : Math.min(principalPayment - interest, balance);
    balance = Math.max(0, balance - amortization);
    rows.push({ month, interest, amortization, invoice: interest + amortization + monthlyFee, balance });
  }

  return {
    rows,
    setupFee,
    totalInterest: sum(rows.map((row) => row.interest)),
    totalAmortization: sum(rows.map((row) => row.amortization)),
    totalMonthlyFees: monthlyFee * months,
    totalInvoices: sum(rows.map((row) => row.invoice)),
  };
}

function valueAtMonth(start, end, month, months = MONTHS) {
  if (month <= 0) return start;
  if (month >= months) return end;
  const ratio = (end / start) ** (month / months);
  return start * ratio;
}

function purchaseOpportunityCost({ price, residualValue, loanRows, downPayment, annualSafeNetRate }) {
  let cost = downPayment * annualSafeNetRate / 12;
  for (let month = 1; month <= MONTHS; month += 1) {
    const value = valueAtMonth(price, residualValue, month);
    const debt = loanRows[month - 1]?.balance ?? 0;
    cost += Math.max(0, value - debt) * annualSafeNetRate / 12;
  }
  return cost;
}

function leaseOpportunityCost({ deposit, initialFee, annualSafeNetRate }) {
  let cost = 0;
  for (let month = 0; month < MONTHS; month += 1) {
    const unconsumedInitialFee = initialFee * (MONTHS - month) / MONTHS;
    cost += (deposit + unconsumedInitialFee) * annualSafeNetRate / 12;
  }
  return cost;
}

function purchaseInputs(scenario) {
  const stress = scenario === "stress";
  return {
    label: "Exempelköp — familjekombi",
    price: 219_900,
    mandatoryFees: 1_495,
    travel: 600,
    downPaymentRate: 0.20,
    annualLoanRate: stress ? 0.0875 : 0.0675,
    loanSetupFee: 595,
    loanMonthlyFee: 39,
    interestTaxReductionRate: 0.30,
    taxReductionVerified: true,
    annualSafeNetRate: 0.025,
    residualValue: stress ? 112_000 : 136_000,
    fuel: stress ? 81_000 * 1.20 : 81_000,
    vehicleTax: 3_300,
    insurance: stress ? 29_700 : 27_000,
    service: stress ? 22_000 : 19_000,
    winterGross: 14_500,
    winterResidual: stress ? 2_000 : 4_000,
    otherTyres: stress ? 12_000 : 8_000,
    expectedRepairs: stress ? 32_000 : 15_000,
    recommendedRepairSavings: stress ? 36_000 : 25_200,
    inspection: 1_300,
  };
}

function leaseInputs(scenario) {
  const stress = scenario === "stress";
  return {
    label: "Exempelleasing — familje-SUV",
    monthlyFee: 4_995 + (stress ? 350 : 0),
    initialFee: 9_995,
    deposit: 5_000,
    setupFee: 995,
    monthlyAdminFee: 59,
    deliveryFee: 0,
    annualSafeNetRate: 0.025,
    fuel: stress ? 76_000 * 1.20 : 76_000,
    vehicleTax: 3_600,
    insurance: stress ? 31_900 : 29_000,
    service: 0,
    winterGross: 15_500,
    winterResidual: stress ? 2_000 : 4_000,
    otherTyres: stress ? 6_000 : 3_000,
    expectedReturnCost: stress ? 18_000 : 7_500,
    recommendedReturnSavings: stress ? 24_000 : 16_200,
  };
}

export function calculatePurchase(scenario = "base", downPaymentRateOverride) {
  const input = purchaseInputs(scenario);
  if (downPaymentRateOverride !== undefined) input.downPaymentRate = downPaymentRateOverride;
  const downPayment = input.price * input.downPaymentRate;
  const loanPrincipal = input.price - downPayment;
  const loan = annuitySchedule({
    principal: loanPrincipal,
    annualRate: input.annualLoanRate,
    setupFee: input.loanSetupFee,
    monthlyFee: input.loanMonthlyFee,
  });
  const taxReduction = input.taxReductionVerified
    ? loan.totalInterest * input.interestTaxReductionRate
    : 0;
  const financeCost = loan.totalInterest + loan.totalMonthlyFees + loan.setupFee - taxReduction;
  const depreciation = input.price - input.residualValue;
  const winterNet = input.winterGross - input.winterResidual;
  const opportunityCost = purchaseOpportunityCost({
    price: input.price,
    residualValue: input.residualValue,
    loanRows: loan.rows,
    downPayment,
    annualSafeNetRate: input.annualSafeNetRate,
  });
  const components = {
    depreciation,
    mandatoryFees: input.mandatoryFees,
    travel: input.travel,
    financeCost,
    opportunityCost,
    fuel: input.fuel,
    vehicleTax: input.vehicleTax,
    insurance: input.insurance,
    service: input.service,
    winterNet,
    otherTyres: input.otherTyres,
    expectedRepairs: input.expectedRepairs,
    inspection: input.inspection,
  };
  const economicCost = sum(Object.values(components));

  const cashOut =
    downPayment +
    input.mandatoryFees +
    input.travel +
    loan.setupFee +
    loan.totalInvoices +
    input.fuel +
    input.vehicleTax +
    input.insurance +
    input.service +
    input.winterGross +
    input.otherTyres +
    input.expectedRepairs +
    input.inspection;
  const cashIn = taxReduction;
  const assetValueAt36 = input.residualValue + input.winterResidual;
  const netCashFlow = cashOut - cashIn;
  const reconciliationDifference = economicCost - (netCashFlow - assetValueAt36 + opportunityCost);

  return {
    kind: "purchase",
    scenario,
    input,
    loan,
    downPayment,
    loanPrincipal,
    taxReduction,
    components,
    economicCost,
    averageMonthlyCost: economicCost / MONTHS,
    cashOut,
    cashIn,
    assetValueAt36,
    netCashFlow,
    opportunityCost,
    reconciliationDifference,
    remainingDebt: loan.rows.at(-1).balance,
  };
}

export function calculateLease(scenario = "base") {
  const input = leaseInputs(scenario);
  const opportunityCost = leaseOpportunityCost(input);
  const winterNet = input.winterGross - input.winterResidual;
  const components = {
    initialFee: input.initialFee,
    monthlyFees: input.monthlyFee * MONTHS,
    setupAndAdmin: input.setupFee + input.monthlyAdminFee * MONTHS + input.deliveryFee,
    opportunityCost,
    fuel: input.fuel,
    vehicleTax: input.vehicleTax,
    insurance: input.insurance,
    service: input.service,
    winterNet,
    otherTyres: input.otherTyres,
    expectedReturnCost: input.expectedReturnCost,
  };
  const economicCost = sum(Object.values(components));
  const cashOut =
    input.initialFee +
    input.deposit +
    input.setupFee +
    input.deliveryFee +
    (input.monthlyFee + input.monthlyAdminFee) * MONTHS +
    input.fuel +
    input.vehicleTax +
    input.insurance +
    input.service +
    input.winterGross +
    input.otherTyres +
    input.expectedReturnCost;
  const cashIn = input.deposit;
  const assetValueAt36 = input.winterResidual;
  const netCashFlow = cashOut - cashIn;
  const reconciliationDifference = economicCost - (netCashFlow - assetValueAt36 + opportunityCost);

  return {
    kind: "lease",
    scenario,
    input,
    components,
    economicCost,
    averageMonthlyCost: economicCost / MONTHS,
    cashOut,
    cashIn,
    assetValueAt36,
    netCashFlow,
    opportunityCost,
    reconciliationDifference,
  };
}

export function extraMileageCosts(annualExtraMil) {
  const totalExtraMil = annualExtraMil * 3;
  return {
    annualExtraMil,
    purchase: totalExtraMil * (12.5 + 4.5 + 3.5 + 4.0),
    lease: totalExtraMil * (12.0 + 11.0 + 2.5),
    note: "Separat känslighet; påverkar inte 1 500-milsrankningen",
  };
}

export function longTermPurchaseProjection() {
  const base = calculatePurchase("base");
  const startValue = base.input.price;
  const year3Value = base.input.residualValue;
  const endValue = 58_000;
  const rows = [];
  for (let year = 1; year <= 8; year += 1) {
    const month = year * 12;
    const value = month <= 36
      ? valueAtMonth(startValue, year3Value, month)
      : valueAtMonth(year3Value, endValue, month - 36, 60);
    const uncertainty = year <= 3 ? 0.08 + year * 0.01 : 0.12 + (year - 3) * 0.04;
    const repairs = year <= 3 ? 5_000 : 7_000 + (year - 4) * 2_000;
    rows.push({
      year,
      value,
      valueLow: value * (1 - uncertainty),
      valueHigh: value * (1 + uncertainty),
      debt: year <= 3 ? base.loan.rows[year * 12 - 1].balance : 0,
      operatingCost: 27_000 + 1_100 + 9_000 + 6_300 + repairs,
      operatingStress: 32_400 + 1_100 + 10_000 + 7_000 + repairs * 1.7,
    });
  }
  return rows;
}

export function invariantSummary(result) {
  return {
    reconciles: Math.abs(result.reconciliationDifference) < 0.01,
    debtCleared: result.kind === "lease" ? true : Math.abs(result.remainingDebt) < 0.01,
    depositExcludedFromCost: result.kind === "purchase" ? true : !Object.hasOwn(result.components, "deposit"),
    repairSavingsExcludedFromCost:
      result.kind === "purchase"
        ? !Object.values(result.components).includes(result.input.recommendedRepairSavings)
        : !Object.values(result.components).includes(result.input.recommendedReturnSavings),
  };
}

export const formatResult = (result) => ({
  type: result.kind,
  scenario: result.scenario,
  total36: round(result.economicCost),
  averageMonth: round(result.averageMonthlyCost),
  cashOut: round(result.cashOut),
  cashIn: round(result.cashIn),
  assetValueAt36: round(result.assetValueAt36),
  netCashFlow: round(result.netCashFlow),
  opportunityCost: round(result.opportunityCost),
  reconciliationDifference: round(result.reconciliationDifference),
  ...invariantSummary(result),
});

export function cashflowSeries(offers, horizon = 60) {
  return offers.map((offer) => Array.from({ length: horizon + 1 }, (_, month) => offer.kind === "lease" && month > 36 ? 0 : offer.economics.monthlyPlan.find((item) => item.month === month)?.totalSek || 0));
}

export function valueDebtSeries(purchases, horizon = 60) {
  return {
    values: purchases.map((offer) => Array.from({ length: horizon + 1 }, (_, month) => month <= 36 ? offer.priceSek + (offer.economics.residual36Sek - offer.priceSek) * month / 36 : offer.economics.residual36Sek * Math.pow(.92, (month - 36) / 12))),
    debts: purchases.map((offer) => Array.from({ length: horizon + 1 }, (_, month) => month <= 36 ? offer.economics.loanPrincipalSek * (1 - month / 36) : 0)),
  };
}

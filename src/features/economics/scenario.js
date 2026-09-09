export const defaultScenario = (parameters) => ({ postalCode: "", driverAge: 35, annualMileageMil: 1500, downPaymentPercent: 20, loanRatePercent: parameters.loanRatePercent, fuelPriceSekPerLitre: parameters.fuelPriceSekPerLitre.Bensin, insuranceLevel: "hel" });

export function readScenario(parameters) {
  try { return { ...defaultScenario(parameters), ...JSON.parse(localStorage.getItem("bilradarn-settings") || "{}") }; } catch { return defaultScenario(parameters); }
}

export function applyScenario(offer, scenario, baseFuelPrice) {
  const baseEconomics = offer.__baseEconomics || offer.economics;
  const mileageFactor = Math.max(0.25, Number(scenario.annualMileageMil || 1500) / 1500);
  const fuelFactor = mileageFactor * (Number(scenario.fuelPriceSekPerLitre || baseFuelPrice) / baseFuelPrice);
  const rateFactor = Math.max(0.2, Number(scenario.loanRatePercent || 0) / 6.1);
  const downFactor = (100 - Number(scenario.downPaymentPercent ?? 20)) / 80;
  const insuranceFactor = scenario.insuranceLevel === "halv" ? 0.82 : scenario.insuranceLevel === "stor" ? 1.18 : 1;
  const rows = baseEconomics.breakdown.map((row) => {
    let amount = row.amountSek;
    if (row.key === "fuel") amount = row.amountSek * fuelFactor;
    if (row.key === "insurance") amount = row.amountSek * insuranceFactor;
    if (row.key === "interest") amount = row.amountSek * rateFactor * downFactor;
    if (row.key === "repair" || row.key === "tyres") amount = row.amountSek * mileageFactor;
    return { ...row, amountSek: Math.round(amount) };
  });
  // Vinterhjul är ett separat, valfritt inköp. Det visas i kostnadsbron men
  // ska inte påverka den jämförbara treårskostnaden eller kassaflödet.
  const total = Math.round(rows.filter((row) => row.key !== "winter").reduce((sum, row) => sum + row.amountSek, 0));
  const monthlyPlan = baseEconomics.monthlyPlan?.map((month) => { const items = month.items.filter((item) => !/vinterhjul/i.test(item.label)).map((item) => { let amount = item.amountSek; if (item.label === "Kontantinsats 20 %") amount = offer.priceSek * (Number(scenario.downPaymentPercent ?? 20) / 100); if (item.label === "Bränsle") amount *= fuelFactor; if (item.label === "Försäkring") amount *= insuranceFactor; if (item.label === "Låneränta") amount *= rateFactor * downFactor; if (item.label === "Amortering") amount *= downFactor; if (item.label === "Reparationsreserv" || item.label === "Däckreserv") amount *= mileageFactor; return { ...item, label: item.label === "Kontantinsats 20 %" ? `Kontantinsats ${scenario.downPaymentPercent} %` : item.label, amountSek: Math.round(amount) }; }); return { ...month, items, totalSek: Math.round(items.reduce((sum, item) => sum + item.amountSek, 0)) }; });
  const loanPrincipalSek = Math.round((offer.priceSek || 0) * downFactor);
  return { ...offer, __baseEconomics: baseEconomics, economics: { ...baseEconomics, breakdown: rows, monthlyPlan, upfrontSek: Math.round((baseEconomics.upfrontSek || 0) * downFactor), loanPrincipalSek, loanRatePercent: Number(scenario.loanRatePercent || baseEconomics.loanRatePercent), total36Sek: total, monthlyEconomicSek: Math.round(total / 36), stressTotal36Sek: Math.round(total * 1.12), stressMonthlySek: Math.round(total * 1.12 / 36), cashPaid36Sek: monthlyPlan?.filter((month) => month.month <= 36).reduce((sum, month) => sum + month.totalSek, 0) ?? baseEconomics.cashPaid36Sek }, scenarioApplied: true };
}

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEconomicsEngine } from "./lib/economics-engine.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PURCHASE_INPUT = resolve(ROOT, "src/data/live-offers.json");
const LEASE_INPUT = resolve(ROOT, "src/data/live-leasing.json");
const OUTPUT = resolve(ROOT, "src/data/report.json");
const MONTHS = 36;
const ANNUAL_MILEAGE_MIL = 1500;
const FUEL_PRICE = { Bensin: 14.82, Diesel: 16.5, hybrid: 14.82 };
const LOAN_RATE = 0.061;
const INSPECTION_PRICE_SEK = 700;

const sources = {
  finance: { label: "Billån – publicerat marknadsriktmärke", url: "https://www.swedbank.se/privat/rantor-priser-och-kurser/lanetjanster.html", note: "Riktmärke 6,1 % nominell rörlig ränta, 20 % kontantinsats, rak amortering över 36 månader. Effektiv ränta och individuella villkor kan avvika." },
  insurance: { label: "Konsumenternas Försäkringsbyrå", url: "https://www.konsumenternas.se/forsakringar/fordonsforsakringar/bilforsakringar/", note: "Premien är personlig; beloppen i rapporten är därför modellestimat tills registreringsnummer och förare offererats." },
  fuel: { label: "Drivkraft Sverige / marknadsantagande", url: "https://drivkraftsverige.se/fakta-statistik/priser/", note: "Bränslepris är ett uppdateringsbart kalkylantagande och inte ett löfte om framtida pris." },
  lease: { label: "Toyota Sverige", url: "https://www.toyota.se/bilar/corolla-touring-sports.Corolla-TS.040.22bf22a9-6cdc-4afd-bc6c-19c4a9bac93d", note: "Kampanj och avtalsram kontrolleras i originalsidan vid varje import." },
};

const round = (n) => Math.round(n);
const sum = (items) => round(items.reduce((total, item) => total + item.amountSek, 0));
const clamp = (min, value, max) => Math.max(min, Math.min(max, value));
const status = (value, sourceUrl = null, note = null) => ({ status: value, sourceUrl, note });

function brandFor(title = "") { return title.split(" ")[0].replace("Škoda", "Skoda"); }
function insuranceMonthly(offer) {
  const title = offer.title.toLowerCase();
  if (/bmw|audi|mercedes|volvo/.test(title)) return 950;
  if (/3008|5008|qashqai|t-roc|duster|kuga|tiguan|ateca/.test(title)) return 800;
  return 700;
}
function repairThreeYears(offer) {
  const title = offer.title.toLowerCase();
  const base = /toyota|kia|hyundai/.test(title) ? 9500 : /peugeot|citro|renault/.test(title) ? 16500 : /bmw|audi|mercedes/.test(title) ? 19000 : 13000;
  return round(base * clamp(.8, offer.mileageMil / 6500, 1.45));
}
function servicePlan(offer) {
  const premium = /bmw|audi|mercedes|volvo/i.test(offer.title) ? 1.35 : 1;
  return [
    { month: 12, label: "Årsservice", amountSek: round(4200 * premium) },
    { month: 24, label: "Större service", amountSek: round(6500 * premium) },
    { month: 36, label: "Årsservice", amountSek: round(4800 * premium) },
    { month: 48, label: "Service efter lånet", amountSek: round(5200 * premium) },
    { month: 60, label: "Större service efter lånet", amountSek: round(7600 * premium) },
  ];
}
function residualValue(offer) {
  const title = offer.title.toLowerCase();
  let retention = /toyota|kia|skoda|volkswagen/.test(title) ? .53 : /hyundai|ford|nissan/.test(title) ? .50 : .47;
  retention -= Math.max(0, offer.mileageMil - 6500) / 100000;
  return round(offer.priceSek * clamp(.42, retention, .56) / 500) * 500;
}
function winterPlan(offer) {
  const included = /s\+v|vinterhjul|vhjul/i.test(`${offer.variant} ${offer.equipment.join(" ")}`);
  return included
    ? { acquisition: 0, residual: 0, wear: 5000, note: "Sommar- och vinterhjul anges i annonsen; skick och mönsterdjup måste kontrolleras." }
    : { acquisition: 14500, residual: 4000, wear: 4000, note: "Separat komplett hjulpaket är modellberäknat; exakt dimension och offert återstår." };
}
function event(month, type, label, amountSek, certainty = "modelled") { return { month, type, label, amountSek: round(amountSek), certainty }; }

function purchaseEconomics(offer, assumptions = {}) {
  const downPaymentPercent = assumptions.downPaymentPercent ?? 20;
  const annualMileageMil = assumptions.annualMileageMil ?? ANNUAL_MILEAGE_MIL;
  const loanRate = (assumptions.loanRatePercent ?? LOAN_RATE * 100) / 100;
  const fuelPrices = assumptions.fuelPriceSekPerLitre ?? FUEL_PRICE;
  const down = round(offer.priceSek * downPaymentPercent / 100);
  const principal = offer.priceSek - down;
  const monthlyPrincipal = principal / MONTHS;
  const interest = Array.from({ length: MONTHS }, (_, i) => (principal - monthlyPrincipal * i) * loanRate / 12);
  const interestTotal = round(interest.reduce((a, b) => a + b, 0) + 550);
  const fuelPrice = offer.fuelType === "Diesel" ? (fuelPrices.Diesel ?? FUEL_PRICE.Diesel) : (fuelPrices.Bensin ?? FUEL_PRICE.Bensin);
  const consumption = offer.consumptionL100Km ?? (offer.fuelType === "Diesel" ? 5.3 : 6.3);
  const fuelMonthly = consumption * (annualMileageMil / 100) * fuelPrice;
  const fuelTotal = round(fuelMonthly * MONTHS);
  const taxAnnual = offer.annualTaxSek ?? (offer.fuelType === "Diesel" ? 2200 : 900);
  const insurance = insuranceMonthly(offer);
  const repairs = repairThreeYears(offer);
  const services = servicePlan(offer);
  const service36 = services.filter((x) => x.month <= 36).reduce((s, x) => s + x.amountSek, 0);
  const winter = winterPlan(offer);
  const residual = residualValue(offer);
  const tradeIn = round(residual * .87 / 500) * 500;
  const opportunity = round(down * .02 * 3 + monthlyPrincipal * .02 * 18 / 12);
  const rows = [
    { key: "price", label: "Bilens annonspris", amountSek: offer.priceSek, evidence: status("verified", offer.sourceUrl) },
    { key: "winter", label: "Vinterhjul, inköp", amountSek: winter.acquisition, evidence: status(winter.acquisition ? "modelled" : "observed", offer.sourceUrl, winter.note) },
    { key: "winterValue", label: "Vinterhjulens värde månad 36", amountSek: -winter.residual, evidence: status("modelled", null, winter.note) },
    { key: "residual", label: "Bilens privata restvärde månad 36", amountSek: -residual, evidence: status("modelled", null, "Försiktig modell utifrån ålder, miltal, märke och dagens annonspris; jämförbara försäljningar återstår.") },
    { key: "interest", label: "Låneränta och uppläggningsavgift", amountSek: interestTotal, evidence: status("modelled", sources.finance.url, sources.finance.note) },
    { key: "fuel", label: "Bränsle, 4 500 mil", amountSek: fuelTotal, evidence: status("modelled", sources.fuel.url, `${consumption.toFixed(1)} l/100 km × ${fuelPrice.toFixed(2)} kr/l.`) },
    { key: "tax", label: "Fordonsskatt, 3 år", amountSek: taxAnnual * 3, evidence: status(offer.annualTaxSek == null ? "estimated" : "observed", offer.sourceUrl, "Annonsuppgift; exakt registerkontroll återstår.") },
    { key: "insurance", label: "Försäkring", amountSek: insurance * MONTHS, evidence: status("estimated", sources.insurance.url, `${insurance} kr/mån tills personlig offert finns.`) },
    { key: "service", label: "Planerad service", amountSek: service36, evidence: status("modelled", null, "Årlig schablon per bilklass; verkstadsoffert och servicebok återstår.") },
    { key: "tyres", label: "Däckslitage och byten", amountSek: winter.wear, evidence: status("modelled", null, winter.note) },
    { key: "repair", label: "Modellspecifik reparationsreserv", amountSek: repairs, evidence: status("modelled", null, `Reserv utifrån märke, biltyp och ${offer.mileageMil} mil; är sparande, inte en säker utgift.`) },
    { key: "inspection", label: "Besiktning", amountSek: INSPECTION_PRICE_SEK, evidence: status("estimated", "https://opus.se/priser/", "Preliminärt en kontrollbesiktning. När Transportstyrelsens datum finns ersätts raden med 700 kr per planerat tillfälle inom perioden.") },
    { key: "travel", label: "Hämtresa", amountSek: Math.max(300, round((offer.distanceKm ?? 0) * 4)), evidence: status("estimated", offer.sourceUrl) },
    { key: "capital", label: "Kapitalets alternativkostnad", amountSek: opportunity, evidence: status("modelled", null, "2 % årlig nettoalternativränta på bundet eget kapital.") },
  ];
  const total = sum(rows);
  const monthlyPlan = [];
  const events = [];
  for (let month = 0; month <= 60; month += 1) {
    const items = [];
    if (month === 0) {
      items.push({ label: "Kontantinsats 20 %", amountSek: down }, { label: "Uppläggningsavgift", amountSek: 550 });
      if (winter.acquisition) items.push({ label: "Vinterhjul", amountSek: winter.acquisition });
    } else {
      if (month <= 36) items.push({ label: "Amortering", amountSek: monthlyPrincipal }, { label: "Låneränta", amountSek: interest[month - 1] });
      items.push({ label: "Bränsle", amountSek: fuelMonthly }, { label: "Försäkring", amountSek: insurance }, { label: "Reparationsreserv", amountSek: repairs / 36 });
      if ([1, 13, 25, 37, 49].includes(month)) items.push({ label: "Fordonsskatt", amountSek: taxAnnual });
      const service = services.find((x) => x.month === month);
      if (service) { items.push({ label: service.label, amountSek: service.amountSek }); events.push(event(month, "service", service.label, service.amountSek)); }
      if (month === 30 && winter.wear) { items.push({ label: "Däckreserv", amountSek: winter.wear }); events.push(event(month, "tyres", "Däckreserv", winter.wear)); }
    }
    monthlyPlan.push({ month, items: items.map((x) => ({ ...x, amountSek: round(x.amountSek) })), totalSek: round(items.reduce((s, x) => s + x.amountSek, 0)) });
  }
  events.push(event(36, "loan", "Lånet slutbetalt", 0, "verified"), event(36, "value", `Privat restvärde ${residual.toLocaleString("sv-SE")} kr`, 0));
  const stressTotal = round(total + residual * .10 + fuelTotal * .20 + insurance * MONTHS * .15 + repairs);
  return {
    ...offer,
    kind: "buy",
    brand: brandFor(offer.title),
    economics: { total36Sek: total, monthlyEconomicSek: round(total / 36), stressTotal36Sek: stressTotal, stressMonthlySek: round(stressTotal / 36), upfrontSek: down + winter.acquisition + 550, residual36Sek: residual, tradeIn36Sek: tradeIn, debt36Sek: 0, loanPrincipalSek: principal, loanRatePercent: loanRate * 100, cashPaid36Sek: monthlyPlan.filter((x) => x.month <= 36).reduce((s, x) => s + x.totalSek, 0), breakdown: rows, monthlyPlan, events },
    evidence: { ...offer.evidence, economics: status("modelled", null, "Alla poster är synliga; annonsdata är källbelagd och antaganden märkta.") },
    quality: { ...offer.quality, rankable: true, rankBlockers: [], warnings: ["Skatt är annonsuppgift tills registerkontroll", "Försäkring kräver personlig offert", "Restvärde, service och reparationsreserv är modellberäknade", ...(offer.quality.nonBlockingUnverified?.length ? [`Ej uttryckligen utskrivet i annonsen (ej krav): ${offer.quality.nonBlockingUnverified.join(", ")}`] : [])] },
  };
}

function leaseEconomics(offer, assumptions = {}) {
  const feeTotal = offer.monthlyFeeSek * 36;
  const setup = offer.setupFeeSek ?? 995;
  const invoice = (offer.invoiceFeeSekPerMonth ?? 59) * 36;
  const fuelPrice = assumptions.fuelPriceSekPerLitre?.hybrid ?? FUEL_PRICE.hybrid;
  const fuelMonthly = offer.consumptionL100Km * ((assumptions.annualMileageMil ?? ANNUAL_MILEAGE_MIL) / 100) * fuelPrice;
  const fuelTotal = round(fuelMonthly * 36);
  const insuranceMonthlySek = 650;
  const winterAcquisition = 14500, winterResidual = 4000, returnReserve = 9000;
  const rows = [
    { key: "firstFee", label: "Förhöjd första leasingavgift", amountSek: offer.firstFeeSek, evidence: status("verified", offer.sourceUrl) },
    { key: "monthlyFees", label: "36 leasingavgifter", amountSek: feeTotal, evidence: status("verified", offer.sourceUrl) },
    { key: "fees", label: "Uppläggning och aviavgifter", amountSek: setup + invoice, evidence: status("estimated", offer.sourceUrl, "Originalsidan anger att avgifter tillkommer; beloppen ska bekräftas i offert.") },
    { key: "fuel", label: "Bränsle, 4 500 mil", amountSek: fuelTotal, evidence: status("modelled", sources.fuel.url, `${offer.consumptionL100Km} l/100 km × ${fuelPrice} kr/l.`) },
    { key: "tax", label: "Fordonsskatt, 3 år", amountSek: offer.annualTaxSek * 3, evidence: status("modelled", offer.sourceUrl, "Bekräftas mot registreringsnummer vid leverans.") },
    { key: "insurance", label: "Försäkring", amountSek: insuranceMonthlySek * 36, evidence: status("estimated", sources.insurance.url, "Personlig premie kräver offert; halvförsäkring antas under vagnskadegaranti.") },
    { key: "service", label: "Planerad service", amountSek: 0, evidence: status("verified", offer.sourceUrl, "Service ingår i kampanjen.") },
    { key: "winter", label: "Vinterhjul, nettokostnad", amountSek: winterAcquisition - winterResidual, evidence: status("modelled", null, "Separat köp antas billigare; hjulen behålls och värderas till 4 000 kr månad 36.") },
    { key: "return", label: "Återlämningsreserv för barnfamilj", amountSek: returnReserve, evidence: status("modelled", offer.termsUrl, "Buffert för onormalt slitage; faktisk kostnad kan bli noll eller högre.") },
  ];
  const total = sum(rows), monthlyPlan = [];
  for (let month = 0; month <= 36; month += 1) {
    const items = [];
    if (month === 0) items.push({ label: "Uppläggningsavgift", amountSek: setup }, { label: "Vinterhjul", amountSek: winterAcquisition });
    else items.push({ label: "Leasingavgift", amountSek: offer.monthlyFeeSek }, { label: "Aviavgift", amountSek: offer.invoiceFeeSekPerMonth ?? 59 }, { label: "Bränsle", amountSek: fuelMonthly }, { label: "Försäkring", amountSek: insuranceMonthlySek }, { label: "Återlämningsreserv", amountSek: returnReserve / 36 });
    if ([1, 13, 25].includes(month)) items.push({ label: "Fordonsskatt", amountSek: offer.annualTaxSek });
    monthlyPlan.push({ month, items: items.map((x) => ({ ...x, amountSek: round(x.amountSek) })), totalSek: round(items.reduce((s, x) => s + x.amountSek, 0)) });
  }
  const stressTotal = round(total + fuelTotal * .20 + insuranceMonthlySek * 36 * .15 + returnReserve);
  return { ...offer, economics: { total36Sek: total, monthlyEconomicSek: round(total / 36), stressTotal36Sek: stressTotal, stressMonthlySek: round(stressTotal / 36), upfrontSek: setup + winterAcquisition, residual36Sek: 0, tradeIn36Sek: 0, debt36Sek: 0, cashPaid36Sek: monthlyPlan.reduce((s, x) => s + x.totalSek, 0), breakdown: rows, monthlyPlan, events: [event(36, "return", "Bilen återlämnas", returnReserve)] }, quality: { rankable: true, rankBlockers: [], warnings: ["Uppläggnings- och aviavgift måste bekräftas", "Försäkring, skatt, vinterhjul och återlämning är antaganden"] } };
}

const economics = createEconomicsEngine({ purchase: purchaseEconomics, lease: leaseEconomics, assumptions: { annualMileageMil: ANNUAL_MILEAGE_MIL, downPaymentPercent: 20, loanRatePercent: LOAN_RATE * 100, fuelPriceSekPerLitre: FUEL_PRICE } });

export async function buildReport() {
  const [purchaseFeed, leaseFeed] = await Promise.all([readFile(PURCHASE_INPUT, "utf8").then(JSON.parse), readFile(LEASE_INPUT, "utf8").then(JSON.parse)]);
  const purchases = purchaseFeed.offers.filter((x) => x.live && x.quality.passesRequiredEquipment).map(economics.purchase).sort((a, b) => a.economics.total36Sek - b.economics.total36Sek).map((x, i) => ({ ...x, rank: i + 1 }));
  const leases = leaseFeed.offers.map(economics.lease).sort((a, b) => a.economics.total36Sek - b.economics.total36Sek).map((x, i) => ({ ...x, rank: i + 1 }));
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), mode: "live", parameters: { horizonMonths: 36, annualMileageMil: ANNUAL_MILEAGE_MIL, downPaymentPercent: 20, fuelPriceSekPerLitre: FUEL_PRICE, loanRatePercent: LOAN_RATE * 100 }, sourceRuns: { purchase: purchaseFeed.generatedAt, lease: leaseFeed.generatedAt }, purchases, leases, excludedPurchases: purchaseFeed.offers.filter((x) => !x.quality.passesRequiredEquipment).map(({ id, title, sourceUrl, missingRequirements }) => ({ id, title, sourceUrl, missingRequirements })), changes: purchaseFeed.changes ?? [], sources: Object.values(sources) };
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildReport();
  console.log(`Byggde rapport med ${report.purchases.length} köp och ${report.leases.length} leasingerbjudande. Ingen testdata används.`);
}

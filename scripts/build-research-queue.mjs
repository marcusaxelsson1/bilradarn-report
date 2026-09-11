import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnrichmentRequest, validateEnrichmentFinding } from "./lib/vehicle-enrichment-adapter.mjs";
import { buildTimelineEvents } from "../src/features/charts/timelineEvents.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = resolve(ROOT, "src/data/report.json");
const QUEUE = resolve(ROOT, "data/research-queue.json");
const FINDINGS_DIR = resolve(ROOT, "data/research-findings");
const STATUS = resolve(ROOT, "src/data/enrichment-status.json");
const RELIABILITY_MODELS = resolve(ROOT, "data/model-reliability.json");
const REGISTRY_PUBLIC = resolve(ROOT, "src/data/registry-public.json");
const REGISTRY_PUBLIC_EXTRA = resolve(ROOT, "src/data/registry-public-extra.json");
const checkedAt = new Date().toISOString();
const INSPECTION_PRICE_SEK = 700;
const INSPECTION_PRICE_SOURCE = "https://opus.se/priser/";

const brandDomain = (title = "") => {
  const key = title.toLowerCase();
  if (key.includes("kia")) return "https://www.kia.com/se/aga/service-oversikt/";
  if (key.includes("toyota")) return "https://www.toyota.se/aga/service";
  if (key.includes("volkswagen")) return "https://www.volkswagen.se/sv/aga/service-och-underhall.html";
  if (key.includes("skoda") || title.includes("Škoda")) return "https://www.skoda.se/service-och-underhall";
  if (key.includes("ford")) return "https://www.ford.se/service";
  if (key.includes("hyundai")) return "https://www.hyundai.com/se/sv/service-och-underhall.html";
  if (key.includes("peugeot")) return "https://www.peugeot.se/service-och-underhall.html";
  if (key.includes("nissan")) return "https://www.nissan.se/aga/service.html";
  return null;
};

function taskFor(offer) {
  return {
    id: offer.id,
    title: offer.title,
    variant: offer.variant,
    registrationNumber: offer.registrationNumber ?? null,
    modelYear: offer.modelYear ?? null,
    mileageMil: offer.mileageMil ?? null,
    sourceUrl: offer.sourceUrl,
    enrichmentRequest: createEnrichmentRequest(offer),
    status: "pending",
    requested: {
      service: { manufacturerPlanUrl: brandDomain(offer.title), fields: ["interval", "nextDue", "operations", "priceAuthorized", "priceIndependent", "priceIncludesVat", "largeServiceAfter36Months"] },
      insurance: { fields: ["annualPremiumRange", "machineDamageMaxAge", "machineDamageMaxMileage", "deductible", "coveredComponents", "personalQuoteRequired"], sources: ["https://www.konsumenternas.se/forsakringar/fordonsforsakringar/bilforsakringar/"] },
      tyres: { fields: ["dimension", "loadIndex", "completeSetPrice", "mountingPrice", "treadLife", "valueAtMonth36"], sources: ["https://www.mekonomen.se/", "https://www.dackonline.se/"] },
      repairs: { fields: ["commonFailures", "partsPrice", "laborPriceAuthorized", "laborPriceIndependent", "threeYearReserve"] },
      reliability: {
        fields: ["summary", "comparisons", "knownIssues", "repairCosts", "warranty", "vehicleDamageWarranty", "limitations", "sources"],
        sources: ["ADAC Pannenstatistik", "What Car? Reliability Survey", "Warrantywise Reliability Index", "official recalls and warranty terms"],
        rules: ["match model generation and powertrain", "exclude normal wear", "keep markets and survey scopes explicit", "never infer a ranking or repair price", "preserve every completed field and only fill missing fields"],
      },
    },
    instruction: `Researchera endast saknade fält för ${offer.title} ${offer.variant} (${offer.modelYear}, ${offer.mileageMil} mil) mot primärkällor och etablerade oberoende index. Bevara befintlig text, verifierade värden och källor ordagrant. Svara bara med uppgifter som kan styrkas med URL och kontrolltid. Håll service, försäkring, däck, reparationer och driftsäkerhet separata. För driftsäkerhet: matcha modellgeneration och drivlina, jämför med relevanta konkurrenter, skilj vanliga modellfel från normalt slitage och ange reparationspris som intervall eller okänt. Markera osäkra uppgifter som estimated eller unknown och hitta aldrig på rankingar.`
  };
}

async function loadFindings() {
  try {
    const findings = await Promise.all((await readdir(FINDINGS_DIR)).filter((name) => name.endsWith(".json")).map(async (name) => JSON.parse(await readFile(resolve(FINDINGS_DIR, name), "utf8"))));
    // Keep historical findings compatible while the adapter validates new
    // provider output at the ingestion boundary.
    findings.forEach((finding) => { try { validateEnrichmentFinding(finding); } catch { /* legacy schema */ } });
    return findings;
  } catch { return []; }
}

function applyFinding(offer, finding, modelReliability = {}) {
  if (!finding || finding.offerId !== offer.id) return { ...offer, reliability: offer.reliability ?? modelReliability[offer.title] ?? null };
  const rows = offer.economics.breakdown.map((row) => {
    const update = finding.costs?.[row.key];
    // Unknown/estimated findings must never turn into zero or overwrite an
    // existing value. Only a finite amount is an admissible numeric update.
    if (!update || !Number.isFinite(update.amountSek)) return row;
    return { ...row, amountSek: Math.round(update.amountSek), evidence: { status: update.status || "verified", sourceUrl: update.sourceUrl || null, checkedAt: update.checkedAt || checkedAt, note: update.note || null } };
  });
  const total = Math.round(rows.reduce((sum, row) => sum + row.amountSek, 0));
  return { ...offer, economics: { ...offer.economics, breakdown: rows, total36Sek: total, monthlyEconomicSek: Math.round(total / 36), stressTotal36Sek: Math.round(total * 1.12), stressMonthlySek: Math.round(total * 1.12 / 36) }, reliability: finding.reliability ?? offer.reliability ?? modelReliability[offer.title] ?? null, maintenance: { ...offer.maintenance, service: finding.service ?? offer.maintenance?.service ?? null }, enrichment: { status: "partially-verified", checkedAt, findingSource: finding.sourceUrl || null } };
}

function applyInspectionBenchmark(offer, registry) {
  if (!registry || offer.kind !== "buy") return offer;
  const inspections = buildTimelineEvents(offer, registry, checkedAt, 1500).filter((item) => item.type === "inspection");
  if (!inspections.length) return offer;
  const count36 = inspections.filter((item) => item.month <= 36).length;
  const note = `${INSPECTION_PRICE_SEK} kr per planerad kontrollbesiktning. Riktmärket är avrundat från Opus publicerade pris från 699 kr för personbil upp till 3 500 kg; faktiskt pris varierar med station, dag och tid.`;
  const breakdown = offer.economics.breakdown.map((row) => row.key === "inspection" ? {
    ...row,
    amountSek: count36 * INSPECTION_PRICE_SEK,
    evidence: { status: "estimated", sourceUrl: INSPECTION_PRICE_SOURCE, checkedAt, note: `${count36} planerade besiktningar inom 36 månader. ${note}` },
  } : row);
  const inspectionByMonth = new Map(inspections.map((item) => [item.month, item]));
  const monthlyPlan = offer.economics.monthlyPlan.map((entry) => {
    const items = entry.items.filter((item) => item.label !== "Besiktning");
    if (inspectionByMonth.has(entry.month)) items.push({ label: "Besiktning", amountSek: INSPECTION_PRICE_SEK });
    return { ...entry, items, totalSek: Math.round(items.reduce((sum, item) => sum + item.amountSek, 0)) };
  });
  const total = Math.round(breakdown.reduce((sum, row) => sum + row.amountSek, 0));
  return {
    ...offer,
    economics: {
      ...offer.economics,
      breakdown,
      monthlyPlan,
      total36Sek: total,
      monthlyEconomicSek: Math.round(total / 36),
      stressTotal36Sek: Math.round(total * 1.12),
      stressMonthlySek: Math.round(total * 1.12 / 36),
      cashPaid36Sek: monthlyPlan.filter((entry) => entry.month <= 36).reduce((sum, entry) => sum + entry.totalSek, 0),
    },
  };
}

export async function buildResearchQueue() {
  const report = JSON.parse(await readFile(REPORT, "utf8"));
  // Research all currently rankable live offers. The first version deliberately
  // used a top-10 pilot; production runs must not silently omit valid adverts.
  const targets = [...report.purchases, ...report.leases];
  const findings = await loadFindings();
  const modelReliability = JSON.parse(await readFile(RELIABILITY_MODELS, "utf8"));
  const registry = { ...JSON.parse(await readFile(REGISTRY_PUBLIC, "utf8")), ...JSON.parse(await readFile(REGISTRY_PUBLIC_EXTRA, "utf8")) };
  const enriched = [...report.purchases, ...report.leases].map((offer) => {
    const withFindings = findings.reduce((current, finding) => applyFinding(current, finding, modelReliability), { ...offer, reliability: offer.reliability ?? modelReliability[offer.title] ?? null });
    return applyInspectionBenchmark(withFindings, registry[String(offer.registrationNumber ?? "").toUpperCase()]);
  });
  const queue = targets.map(taskFor).map((task) => {
    const finding = findings.find((item) => item.offerId === task.id);
    const reliability = finding?.reliability ?? modelReliability[task.title] ?? null;
    const reliabilityComplete = Boolean(reliability?.summary && reliability?.sources?.length);
    return { ...task, existingFinding: finding || reliability ? { reliability } : null, missing: { reliability: !reliabilityComplete }, status: reliabilityComplete ? "received" : "pending" };
  });
  await mkdir(dirname(QUEUE), { recursive: true });
  await mkdir(FINDINGS_DIR, { recursive: true });
  await writeFile(QUEUE, `${JSON.stringify({ schemaVersion: 1, generatedAt: checkedAt, horizonMonths: 36, annualMileageMil: 1500, tasks: queue }, null, 2)}\n`, "utf8");
  const purchases = enriched.filter((offer) => offer.kind === "buy").sort((a, b) => a.economics.total36Sek - b.economics.total36Sek).map((offer, index) => ({ ...offer, rank: index + 1 }));
  const leases = enriched.filter((offer) => offer.kind === "lease").sort((a, b) => a.economics.total36Sek - b.economics.total36Sek).map((offer, index) => ({ ...offer, rank: index + 1 }));
  const next = { ...report, purchases, leases, generatedAt: checkedAt };
  await writeFile(REPORT, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await writeFile(STATUS, `${JSON.stringify({ generatedAt: checkedAt, pending: queue.filter((task) => task.status === "pending").length, received: queue.filter((task) => task.status === "received").length, scope: "Alla rankbara köp + aktuella leasingerbjudanden" }, null, 2)}\n`, "utf8");
  return { queue, pending: queue.filter((task) => task.status === "pending").length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildResearchQueue();
  console.log(`Kostnadsberikningskö: ${result.pending} uppgifter väntar på källresearch.`);
}

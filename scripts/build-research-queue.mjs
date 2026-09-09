import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnrichmentRequest, validateEnrichmentFinding } from "./lib/vehicle-enrichment-adapter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = resolve(ROOT, "src/data/report.json");
const QUEUE = resolve(ROOT, "data/research-queue.json");
const FINDINGS_DIR = resolve(ROOT, "data/research-findings");
const STATUS = resolve(ROOT, "src/data/enrichment-status.json");
const checkedAt = new Date().toISOString();

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
    },
    instruction: `Researchera ${offer.title} ${offer.variant} (${offer.modelYear}, ${offer.mileageMil} mil) mot primärkällor. Svara bara med uppgifter som kan styrkas med URL och kontrolltid. Håll service, försäkring, däck och reparationer separata. Markera okända uppgifter som estimated.`
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

function applyFinding(offer, finding) {
  if (!finding || finding.offerId !== offer.id) return offer;
  const rows = offer.economics.breakdown.map((row) => {
    const update = finding.costs?.[row.key];
    return update ? { ...row, amountSek: Math.round(update.amountSek), evidence: { status: update.status || "verified", sourceUrl: update.sourceUrl || null, checkedAt: update.checkedAt || checkedAt, note: update.note || null } } : row;
  });
  const total = Math.round(rows.reduce((sum, row) => sum + row.amountSek, 0));
  return { ...offer, economics: { ...offer.economics, breakdown: rows, total36Sek: total, monthlyEconomicSek: Math.round(total / 36), stressTotal36Sek: Math.round(total * 1.12), stressMonthlySek: Math.round(total * 1.12 / 36) }, enrichment: { status: "partially-verified", checkedAt, findingSource: finding.sourceUrl || null } };
}

export async function buildResearchQueue() {
  const report = JSON.parse(await readFile(REPORT, "utf8"));
  // Research all currently rankable live offers. The first version deliberately
  // used a top-10 pilot; production runs must not silently omit valid adverts.
  const targets = [...report.purchases, ...report.leases];
  const findings = await loadFindings();
  const enriched = [...report.purchases, ...report.leases].map((offer) => findings.reduce(applyFinding, offer));
  const queue = targets.map(taskFor).map((task) => {
    const finding = findings.find((item) => item.offerId === task.id);
    return { ...task, status: finding ? "received" : "pending" };
  });
  await mkdir(dirname(QUEUE), { recursive: true });
  await mkdir(FINDINGS_DIR, { recursive: true });
  await writeFile(QUEUE, `${JSON.stringify({ schemaVersion: 1, generatedAt: checkedAt, horizonMonths: 36, annualMileageMil: 1500, tasks: queue }, null, 2)}\n`, "utf8");
  const next = { ...report, purchases: enriched.filter((offer) => offer.kind === "buy"), leases: enriched.filter((offer) => offer.kind === "lease"), generatedAt: checkedAt };
  await writeFile(REPORT, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await writeFile(STATUS, `${JSON.stringify({ generatedAt: checkedAt, pending: queue.filter((task) => task.status === "pending").length, received: queue.filter((task) => task.status === "received").length, scope: "Alla rankbara köp + aktuella leasingerbjudanden" }, null, 2)}\n`, "utf8");
  return { queue, pending: queue.filter((task) => task.status === "pending").length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildResearchQueue();
  console.log(`Kostnadsberikningskö: ${result.pending} uppgifter väntar på källresearch.`);
}

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "src/data/live-leasing.json");
const TOYOTA_URL = "https://www.toyota.se/bilar/corolla-touring-sports.Corolla-TS.040.22bf22a9-6cdc-4afd-bc6c-19c4a9bac93d";
const TOYOTA_CONFIG_URL = "https://easyprivatleasing.toyota.se/konfiguration/modell/corolla-ts";

function plain(html) {
  return html.replace(/&nbsp;|&#160;/gi, " ").replace(/&aring;/gi, "å").replace(/&auml;/gi, "ä").replace(/&ouml;/gi, "ö").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Bilradarn/1.0 private offer verification" }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${response.status} från ${url}`);
  return response.text();
}

export function normalizeToyota(modelHtml, configHtml, checkedAt = new Date().toISOString()) {
  const text = `${plain(modelHtml)} ${plain(configHtml)}`;
  const hasModel = /Corolla Touring Sports/i.test(text);
  const hasPrice = /3\s*395\s*kr\s*\/\s*mån|3395(?:\.0)?/i.test(text);
  const hasTerm = /36\s*mån/i.test(text);
  const hasMileage = /4\s*500\s*mil/i.test(text);
  if (!hasModel || !hasPrice || !hasTerm || !hasMileage) throw new Error("Toyotas aktuella 36-månaderserbjudande kunde inte verifieras i originalsidan");
  const image = modelHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
    ?? modelHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
    ?? null;
  return {
    id: "toyota:corolla-ts:easy-privatleasing",
    kind: "lease",
    live: true,
    title: "Toyota Corolla Touring Sports Hybrid",
    variant: "1.8 Hybrid Touring Sports Active · Automat",
    priceSek: null,
    monthlyFeeSek: 3395,
    termMonths: 36,
    includedMileageMil: 4500,
    annualMileageMil: 1500,
    extraMileageSekPerMil: 12.5,
    firstFeeSek: 0,
    setupFeeSek: null,
    invoiceFeeSekPerMonth: null,
    serviceIncluded: true,
    fuelType: "Bensin/elhybrid utan laddkabel",
    consumptionL100Km: 4.7,
    annualTaxSek: 360,
    dealer: "Auktoriserad Toyota-återförsäljare",
    place: "Göteborgsområdet",
    distanceKm: null,
    sourceUrl: TOYOTA_URL,
    termsUrl: TOYOTA_CONFIG_URL,
    sourceCheckedAt: checkedAt,
    imageUrls: image ? [image] : [],
    equipment: ["Automat", "Autobroms", "Antisladdsystem", "ISOFIX", "Backkamera", "Parkeringssensorer"],
    requiredEquipment: { antisladd: true, isofix: true, parking: true, camera: true },
    evidence: {
      listing: { status: "verified", sourceUrl: TOYOTA_URL, checkedAt },
      monthlyFee: { status: "verified", sourceUrl: TOYOTA_URL, checkedAt },
      term: { status: "verified", sourceUrl: TOYOTA_URL, checkedAt },
      mileage: { status: "verified", sourceUrl: TOYOTA_URL, checkedAt },
      extraMileage: { status: "observed", sourceUrl: TOYOTA_CONFIG_URL, checkedAt },
      tax: { status: "modelled", sourceUrl: TOYOTA_URL, checkedAt, note: "Kontrolleras mot registreringsnummer vid offert" },
    },
  };
}

export async function importLeasing() {
  const checkedAt = new Date().toISOString();
  const [modelHtml, configHtml] = await Promise.all([fetchText(TOYOTA_URL), fetchText(TOYOTA_CONFIG_URL)]);
  const result = { schemaVersion: 1, generatedAt: checkedAt, mode: "live", offers: [normalizeToyota(modelHtml, configHtml, checkedAt)], errors: [] };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importLeasing();
  console.log(`Importerade ${result.offers.length} aktuellt privatleasingerbjudande från tillverkarens originalsida.`);
}

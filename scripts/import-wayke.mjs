import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "src/data/live-offers.json");
const HISTORY = resolve(ROOT, "data/import-history.json");
const WAYKE_ORIGIN = "https://www.wayke.se";

export const SEARCH_FILTERS = {
  latitude: 57.7089,
  longitude: 11.9746,
  radiusKm: 150,
  priceMin: 120000,
  priceMax: 250000,
  modelYearMin: 2021,
  modelYearMax: 2023,
  mileageMaxMil: 10000,
};

const RANKING_REQUIREMENTS = [];

const FAMILY_PATTERNS = [
  /ceed sportswagon|corolla touring sports|octavia|superb|passat|golf sportscombi|golf variant|tiguan|t-roc/,
  /v60|v90|xc40|xc60|focus.*(kombi|wagon)|kuga|mondeo|tucson|i30.*(kombi|wagon)/,
  /3008|5008|308 sw|megane.*(sport tourer|grandtour)|arkana|austral|cx-5|mazda 6/,
  /leon.*(sportstourer|st)|ateca|duster|3-serie.*touring|x1|a4.*avant|q3|c-klass.*(kombi|estate)|gla/,
  /qashqai|x-trail|astra.*sports tourer|insignia|grandland|cr-v|rav4|s-cross|vitara/,
];

const REQUIRED_EQUIPMENT = {
  antisladd: [/antisladd/, /stabilitetskontroll/, /electronic stability/, /\besc\b/],
  isofix: [/isofix/],
  parking: [/parkeringssensor/, /park assist/, /parkeringsassist/],
  camera: [/backkamera/, /parkeringskamera/, /360.?kamera/, /\bkamera\b/, /rear.?view.?camera/],
};

function decodeHtml(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseReactQueryPayload(html) {
  const match = html.match(/window\["__RQ_R_lb_"\]\.push\((\{.*?\})\);<\/script>/s);
  if (!match) throw new Error("Waykes strukturerade sökdata saknas i HTML-svaret");
  return JSON.parse(match[1]);
}

export function extractSearchDocuments(html) {
  const payload = parseReactQueryPayload(html);
  const query = payload.queries?.find((entry) => entry.queryKey?.[0] === "vehicles");
  if (!query?.state?.data?.documentList) throw new Error("Waykes fordonslista saknas i söksvaret");
  return {
    totalHits: query.state.data.documentList.numberOfHits ?? 0,
    queryKey: query.queryKey,
    documents: query.state.data.documentList.documents ?? [],
  };
}

export function extractCarJsonLd(html) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs)];
  for (const match of matches) {
    try {
      const value = JSON.parse(match[1]);
      if (value?.["@type"] === "Car") return value;
    } catch {
      // Ignore unrelated malformed metadata; the missing Car object is reported below.
    }
  }
  throw new Error("Bilens Car-metadata saknas på detaljsidan");
}

export function extractDefinitionPairs(html) {
  const pairs = [];
  for (const match of html.matchAll(/<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gs)) {
    const label = decodeHtml(match[1]);
    const value = decodeHtml(match[2]);
    if (label && value) pairs.push({ label, value });
  }
  return pairs;
}

function findPair(pairs, matcher) {
  return pairs.find(({ label }) => matcher.test(label))?.value ?? null;
}

function numberFromText(value) {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesFamily(document) {
  const text = `${document.title ?? ""} ${document.shortDescription ?? ""}`.toLowerCase();
  return FAMILY_PATTERNS.some((pattern) => pattern.test(text));
}

function samplePriority(document) {
  const agePenalty = Math.max(0, SEARCH_FILTERS.modelYearMax - Number(document.modelYear || 0)) * 5000;
  const text = `${document.title ?? ""} ${document.shortDescription ?? ""}`.toLowerCase();
  const equipmentBonus = /kamera|camera/.test(text) ? 60000 : 0;
  return Number(document.price || 9999999) + Number(document.mileage || 99999) * 2 + agePenalty - equipmentBonus;
}

function equipmentChecks(labels, marketedText) {
  const haystack = `${labels.join(" | ")} | ${marketedText}`.toLowerCase();
  return Object.fromEntries(
    Object.entries(REQUIRED_EQUIPMENT).map(([key, patterns]) => [key, patterns.some((pattern) => pattern.test(haystack))]),
  );
}

function collectImageUrls(html, car) {
  const urls = new Set(Array.isArray(car.image) ? car.image : car.image ? [car.image] : []);
  for (const match of html.matchAll(/https:\/\/cdn\.wayke\.se\/media\/[a-f0-9-]+\/[a-f0-9-]+/gi)) urls.add(match[0]);
  for (const match of html.matchAll(/https:\/\/cdn\.wayke\.se\/cfit\/v3\/[a-f0-9-]+\/[a-f0-9-]+/gi)) {
    urls.add(`${match[0]}?format=jpeg&w=1170`);
  }
  return [...urls].slice(0, 40);
}

export function normalizeDetail(document, html, checkedAt = new Date().toISOString()) {
  const car = extractCarJsonLd(html);
  const pairs = extractDefinitionPairs(html);
  const yesEquipment = [...new Set(pairs.filter(({ value }) => /^ja$/i.test(value)).map(({ label }) => label))];
  const marketedText = `${document.shortDescription ?? ""} ${car.vehicleConfiguration ?? ""}`;
  const checks = equipmentChecks(yesEquipment, marketedText);
  const missingRequirements = Object.entries(checks).filter(([, present]) => !present).map(([key]) => key);
  const rankingMissingRequirements = RANKING_REQUIREMENTS.filter((key) => !checks[key]);
  const registrationNumber = car.identifier?.value ?? null;
  const sourceUrl = car.url || `${WAYKE_ORIGIN}/objekt/${document._id}`;
  const annualTax = numberFromText(findPair(pairs, /årlig fordonsskatt/i));
  const malusTax = numberFromText(findPair(pairs, /malus/i));

  return {
    id: `wayke:${document._id}`,
    kind: "purchase",
    live: true,
    lifecycle: "observed",
    title: car.name || document.title,
    variant: document.shortDescription || car.vehicleConfiguration || "Variant ej angiven",
    registrationNumber,
    vin: car.vehicleIdentificationNumber ?? null,
    priceSek: Number(car.offers?.price ?? document.price),
    modelYear: Number(car.vehicleModelDate ?? document.modelYear),
    mileageMil: Number(document.mileage),
    fuelType: document.fuelType,
    transmission: car.vehicleTransmission || document.gearboxType,
    bodyType: car.bodyType ?? null,
    color: car.color ?? null,
    consumptionL100Km: numberFromText(car.fuelConsumption?.value),
    annualTaxSek: annualTax,
    malusTaxSek: malusTax,
    dealer: car.offers?.seller?.name || document.branches?.[0]?.name || "Okänd handlare",
    dealerUrl: car.offers?.seller?.url ?? null,
    place: document.position?.city ?? null,
    distanceKm: Math.round(Number(document.distance ?? 0)),
    sourceUrl,
    sourceOwner: "Wayke / angiven bilhandlare",
    sourceCheckedAt: checkedAt,
    publishedAt: document.itemPublished ?? car.offers?.validFrom ?? null,
    availability: car.offers?.availability?.endsWith("InStock") ? "available" : "unknown",
    equipment: yesEquipment,
    requiredEquipment: checks,
    missingRequirements,
    imageUrls: collectImageUrls(html, car),
    evidence: {
      listing: { status: "verified", sourceUrl, checkedAt },
      price: { status: "verified", sourceUrl, checkedAt },
      identity: { status: registrationNumber ? "observed" : "missing", sourceUrl, checkedAt },
      tax: { status: annualTax != null ? "observed" : "missing", sourceUrl, checkedAt, note: "Exakt registerkontroll återstår" },
      equipment: { status: missingRequirements.length ? "incomplete" : "observed", sourceUrl, checkedAt },
      economics: { status: "missing", sourceUrl: null, checkedAt: null, note: "Ej rankningsbar före kostnadsberikning" },
    },
    quality: {
      passesListingFilters: true,
      passesRequiredEquipment: rankingMissingRequirements.length === 0,
      rankable: false,
      nonBlockingUnverified: missingRequirements.filter((key) => !RANKING_REQUIREMENTS.includes(key)),
      rankBlockers: [
        ...(rankingMissingRequirements.length ? [`Saknar annonsbevis för: ${rankingMissingRequirements.join(", ")}`] : []),
        "Skatt behöver registerverifieras",
        "Försäkring, service, reparationer, vinterhjul, finansiering och restvärde saknas",
      ],
    },
  };
}

export function buildSearchUrl(offset = 0) {
  const params = new URLSearchParams({
    lat: String(SEARCH_FILTERS.latitude),
    lon: String(SEARCH_FILTERS.longitude),
    "position.location": String(SEARCH_FILTERS.radiusKm),
    "position.name": "Göteborg",
    "price.min": String(SEARCH_FILTERS.priceMin),
    "price.max": String(SEARCH_FILTERS.priceMax),
    "modelYear.min": String(SEARCH_FILTERS.modelYearMin),
    "modelYear.max": String(SEARCH_FILTERS.modelYearMax),
    "mileage.max": String(SEARCH_FILTERS.mileageMaxMil),
    gearboxType: "Automat",
    offset: String(offset),
    sort: "itemSortDesc",
  });
  for (const fuel of ["Bensin", "Diesel"]) params.append("fuelType", fuel);
  for (const chassis of ["Kombi", "SUV", "Halvkombi"]) params.append("chassis", chassis);
  return `${WAYKE_ORIGIN}/sok?${params}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Bilradarn/0.1 private research; source verification" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${response.status} från ${url}`);
  return response.text();
}

async function loadPrevious() {
  try { return JSON.parse(await readFile(OUTPUT, "utf8")); } catch { return { offers: [] }; }
}

function detectChanges(previous, nextOffers) {
  const before = new Map((previous.offers ?? []).map((offer) => [offer.id, offer]));
  const after = new Map(nextOffers.map((offer) => [offer.id, offer]));
  const changes = [];
  for (const offer of nextOffers) {
    const old = before.get(offer.id);
    if (!old) changes.push({ type: "new", id: offer.id, title: offer.title, at: offer.sourceCheckedAt });
    else if (old.priceSek !== offer.priceSek) changes.push({ type: "price", id: offer.id, title: offer.title, before: old.priceSek, after: offer.priceSek, at: offer.sourceCheckedAt });
  }
  for (const offer of before.values()) if (!after.has(offer.id)) changes.push({ type: "not-in-current-sample", id: offer.id, title: offer.title, at: new Date().toISOString() });
  return changes;
}

export async function importWayke({ pages = 8, detailLimit = 40 } = {}) {
  const checkedAt = new Date().toISOString();
  const searchDocuments = [];
  let totalHits = 0;
  for (let page = 0; page < pages; page += 1) {
    const html = await fetchText(buildSearchUrl(page * 24));
    const result = extractSearchDocuments(html);
    totalHits = result.totalHits;
    searchDocuments.push(...result.documents);
    if (result.documents.length < 24) break;
  }

  const candidates = [...new Map(searchDocuments.map((document) => [document._id, document])).values()]
    .filter((document) => matchesFamily(document))
    .sort((a, b) => samplePriority(a) - samplePriority(b))
    .slice(0, detailLimit);

  const offers = [];
  const errors = [];
  for (const document of candidates) {
    const url = `${WAYKE_ORIGIN}/objekt/${document._id}`;
    try {
      offers.push(normalizeDetail(document, await fetchText(url), checkedAt));
    } catch (error) {
      errors.push({ id: document._id, url, message: error.message });
    }
  }

  const previous = await loadPrevious();
  const result = {
    schemaVersion: 1,
    generatedAt: checkedAt,
    mode: "live",
    source: {
      name: "Wayke",
      role: "Upptäckts- och detaljkälla för svenska bilhandlarannonser",
      searchUrl: buildSearchUrl(0),
      searchPagesRead: pages,
      reportedHits: totalHits,
      documentsRead: searchDocuments.length,
      detailPagesRead: offers.length,
    },
    filters: SEARCH_FILTERS,
    offers,
    changes: detectChanges(previous, offers),
    errors,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await mkdir(dirname(HISTORY), { recursive: true });
  let history = [];
  try { history = JSON.parse(await readFile(HISTORY, "utf8")); } catch { /* first run */ }
  history.push({ generatedAt: checkedAt, offers: offers.length, changes: result.changes, errors });
  await writeFile(HISTORY, `${JSON.stringify(history.slice(-60), null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importWayke();
  console.log(`Importerade ${result.offers.length} riktiga annonser från ${result.source.documentsRead} sökträffar.`);
  console.log(`${result.offers.filter((offer) => offer.quality.passesRequiredEquipment).length} annonser är rankningsbara efter grundfiltren; utrustning med okänd status märks separat.`);
  console.log(`${result.changes.length} förändringar, ${result.errors.length} detaljfel.`);
}

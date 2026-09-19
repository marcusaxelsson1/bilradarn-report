import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSourceFile, buildDealerEnvelope, filterCandidates } from "../lib/adapter-base.mjs";
import { discoverDinBilCards } from "../lib/browser-discovery.mjs";
import { extractCarJsonLd, extractNextData, normalizeRegNumber, numberFromText } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";

const ORIGIN = "https://dinbil.se";
const SOURCE_KEY = "dinbil";

function titleCase(value) {
  const text = String(value ?? "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function extractCar(html) {
  const data = extractNextData(html);
  const car = data?.props?.pageProps?.car;
  if (!car) throw new Error("Din Bils car-objekt saknas i __NEXT_DATA__");
  return car;
}

export function normalizeDetail(url, html, checkedAt = new Date().toISOString()) {
  const car = extractCar(html);
  let jsonLd = null;
  try { jsonLd = extractCarJsonLd(html); } catch { /* JSON-LD är ett komplement, inte ett krav */ }
  const reg = normalizeRegNumber(car.regNumber ?? car.regNr);
  const equipment = [
    ...(Array.isArray(car.equipment) ? car.equipment : []),
    ...(Array.isArray(car.factoryEquipment) ? car.factoryEquipment.map((entry) => entry.text).filter(Boolean) : []),
  ];
  const images = (Array.isArray(car.images) ? car.images : []).filter(Boolean);

  return buildPurchaseOffer({
    id: `dinbil:${reg ?? car.chassiNumber ?? url}`,
    title: jsonLd?.name ?? [car.make, car.model].filter(Boolean).join(" "),
    variant: car.version ?? null,
    registrationNumber: reg,
    vin: car.chassiNumber ?? jsonLd?.vehicleIdentificationNumber ?? null,
    priceSek: car.pricePoints?.actualCost ?? car.pricePoints?.cost ?? null,
    modelYear: car.modelYear ?? null,
    mileageMil: car.mileage != null ? Number(car.mileage) : null,
    fuelType: car.fuelType ?? car.fuel ?? null,
    transmission: car.gearType ?? car.transmission ?? null,
    bodyType: titleCase(car.bodyType ?? car.chassis).replace(/^suv$/i, "SUV").replace(/^mpv$/i, "MPV"),
    color: car.color ?? null,
    consumptionL100Km: numberFromText(String(car.consumption_wltp ?? "").replace("l/100km", "").replace("l/100 km", "")),
    annualTaxSek: car.tax != null ? Number(car.tax) : null,
    malusTaxSek: car.malus != null ? Number(car.malus) : null,
    dealer: car.dinBilRetailerName ?? "Din Bil",
    place: car.facility?.name ?? null,
    sourceUrl: url,
    sourceOwner: "Din Bil",
    sourceCheckedAt: checkedAt,
    publishedAt: car.firstRegDate ?? null,
    availability: car.soldDate ? "unavailable" : "unknown",
    equipment,
    marketedText: [car.searchString, ...equipment].filter(Boolean).join(" "),
    imageUrls: images,
    lifecycle: "preliminary",
  });
}

export function normalizeListCard(card, checkedAt = new Date().toISOString()) {
  const reg = normalizeRegNumber(card.reg);
  const url = `${ORIGIN}/bilar-i-lager/begagnat/${String(card.reg ?? "").toLowerCase()}`;
  const priceSek = numberFromText(card.price);
  const tags = (card.tags ?? []).map((tag) => String(tag).trim());
  let modelYear = null;
  let fuelType = null;
  let transmission = null;
  let mileageMil = null;
  for (const tag of tags) {
    if (/^\d{4}$/.test(tag) && modelYear == null) modelYear = Number(tag);
    else if (/mil/i.test(tag)) mileageMil = numberFromText(tag);
    else if (/automat/i.test(tag)) transmission = "Automat";
    else if (/manuell/i.test(tag)) transmission = "Manuell";
    else if (/^(bensin|diesel|el|hybrid|laddhybrid|mildhybrid|elhybrid|etanol|gas)$/i.test(tag) && fuelType == null) fuelType = tag;
  }
  const [dealer, place] = (card.location ?? "").split("/").map((part) => part.trim());

  return buildPurchaseOffer({
    id: `dinbil:${reg ?? card.reg}`,
    title: card.title,
    variant: card.variant,
    registrationNumber: reg,
    priceSek,
    modelYear,
    mileageMil,
    fuelType,
    transmission,
    bodyType: null,
    dealer: dealer || "Din Bil",
    place: place || null,
    sourceUrl: url,
    sourceOwner: "Din Bil",
    sourceCheckedAt: checkedAt,
    availability: "unknown",
    equipment: [],
    marketedText: [card.title, card.variant, ...tags].filter(Boolean).join(" "),
    imageUrls: card.image ? [card.image] : [],
    lifecycle: "preliminary",
  });
}

export async function importDinBil({ detailLimit = Infinity, maxClicks = 40 } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  const cards = await discoverDinBilCards({ maxClicks });

  const normalized = cards.slice(0, detailLimit).map((card) => normalizeListCard(card, checkedAt));
  const { included: offers, funnel } = filterCandidates(normalized, { discovered: cards.length, prefiltered: normalized.length, detailPagesRequested: 0 });

  const result = buildDealerEnvelope({ key: SOURCE_KEY, name: "Din Bil", role: "Handlaradapter för Din Bils publika begagnadlager (webbläsar-paginering)", checkedAt, offers, errors, extraSource: { list: `${ORIGIN}/bilar-i-lager/begagnat`, discovered: cards.length, funnel } });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importDinBil();
  console.log(`Din Bil: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}

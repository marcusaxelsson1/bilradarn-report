import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, writeSourceFile, buildDealerEnvelope, mapConcurrent, filterCandidates } from "../lib/adapter-base.mjs";
import { discoverKamuxUrls } from "../lib/browser-discovery.mjs";
import { extractCarJsonLd, extractNextData, normalizeRegNumber } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";
import { matchesFamilyUrl } from "../lib/filters.mjs";

const ORIGIN = "https://www.kamux.se";
const SOURCE_KEY = "kamux";

const BODY_TYPE_CODES = {
  Lim: "Sedan", Sedan: "Sedan", Kombi: "Kombi", Wagon: "Kombi", SUV: "SUV", Halvkombi: "Halvkombi", Hatch: "Halvkombi", Cab: "Cab", MPV: "MPV", Van: "Van",
};

const FUEL_TYPE_CODES = {
  BN: "Bensin", Petrol: "Bensin", Bensin: "Bensin", D: "Diesel", DS: "Diesel", Diesel: "Diesel", EL: "El", Electric: "El", HY: "Hybrid", Hybrid: "Hybrid", "25": "Hybrid", "10": "Mildhybrid", PHEV: "Laddhybrid", PlugIn: "Laddhybrid", CNG: "Gas", E85: "Etanol",
};

export function mapBodyType(code) {
  return BODY_TYPE_CODES[code] ?? code ?? null;
}

export function mapFuelType(code) {
  return FUEL_TYPE_CODES[code] ?? code ?? null;
}

export function extractVehicle(html) {
  const data = extractNextData(html);
  const pageProps = data?.props?.pageProps ?? {};
  if (pageProps.regNo || pageProps.vehicleIdentificationNumber) return pageProps;
  for (const key of ["vehicle", "car", "product", "data", "vehicleData"]) {
    const candidate = pageProps[key];
    if (candidate && typeof candidate === "object" && (candidate.regNo || candidate.vehicleIdentificationNumber)) return candidate;
  }
  throw new Error("Kamux fordonsdata saknas i __NEXT_DATA__");
}

export function normalizeDetail(url, html, checkedAt = new Date().toISOString()) {
  const vehicle = extractVehicle(html);
  let jsonLd = null;
  try { jsonLd = extractCarJsonLd(html); } catch { /* JSON-LD är ett komplement, inte ett krav */ }

  const equipment = [
    ...(Array.isArray(vehicle.equipment) ? vehicle.equipment : []),
    ...(Array.isArray(vehicle.productEquipment) ? vehicle.productEquipment.map((entry) => entry.label).filter(Boolean) : []),
  ];
  const images = (Array.isArray(vehicle.photos) ? vehicle.photos : []).filter(Boolean);
  const reg = normalizeRegNumber(vehicle.regNo);
  const manufacturer = jsonLd?.manufacturer?.name ?? vehicle.manufacturer ?? null;
  const model = jsonLd?.model ?? vehicle.model ?? null;
  const title = jsonLd?.name ?? [manufacturer, model].filter(Boolean).join(" ");

  return buildPurchaseOffer({
    id: `kamux:${reg ?? vehicle.id ?? vehicle.productId ?? url}`,
    title,
    variant: jsonLd?.vehicleConfiguration ?? vehicle.modelType ?? null,
    registrationNumber: reg,
    vin: vehicle.vehicleIdentificationNumber ?? null,
    priceSek: vehicle.price ?? jsonLd?.offers?.price ?? null,
    modelYear: vehicle.modelYear ?? jsonLd?.vehicleModelDate ?? null,
    mileageMil: vehicle.mileage != null ? Math.round(Number(vehicle.mileage) / 10) : null,
    fuelType: vehicle.plugIn || Number(vehicle.kamuxFuelType) === 19
      ? "Laddhybrid"
      : Number(vehicle.kamuxFuelType) === 17
        ? "Hybrid"
        : Number(vehicle.kamuxFuelType) === 18
          ? "Mildhybrid"
          : mapFuelType(vehicle.fuelTypeCode) ?? mapFuelType(jsonLd?.fuelType),
    transmission: String(vehicle.gearType ?? jsonLd?.vehicleTransmission ?? "").replace(/^automatic$/i, "Automat").replace(/^manual$/i, "Manuell") || null,
    bodyType: mapBodyType(vehicle.bodyType ?? jsonLd?.bodyType),
    color: vehicle.color ?? jsonLd?.color ?? null,
    dealer: "Kamux",
    place: vehicle.outlet?.name ?? vehicle.outlet ?? null,
    sourceUrl: url,
    sourceOwner: "Kamux",
    sourceCheckedAt: checkedAt,
    publishedAt: vehicle.firstRegistrationDate ?? null,
    availability: vehicle.isDeleted ? "unavailable" : vehicle.isOnSale ? "available" : "unknown",
    equipment,
    marketedText: [title, vehicle.marketingTextLong, ...equipment].filter(Boolean).join(" "),
    imageUrls: images,
    lifecycle: "preliminary",
  });
}

export async function importKamux({ detailLimit = Infinity, maxPages = 50 } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  const discovered = await discoverKamuxUrls({ maxPages });
  const detailUrls = discovered.filter(matchesFamilyUrl);

  const normalized = [];
  await mapConcurrent(detailUrls.slice(0, detailLimit), 6, async (url) => {
    try {
      const offer = normalizeDetail(url, await fetchText(url), checkedAt);
      normalized.push(offer);
    } catch (error) {
      errors.push({ url, message: error.message });
    }
  });

  const { included: offers, funnel } = filterCandidates(normalized, { discovered: discovered.length, prefiltered: detailUrls.length, detailPagesRequested: detailUrls.length });
  const result = buildDealerEnvelope({ key: SOURCE_KEY, name: "Kamux", role: "Handlaradapter för Kamux publika begagnadlager (webbläsar-paginering)", checkedAt, offers, errors, extraSource: { search: `${ORIGIN}/search`, discovered: discovered.length, funnel } });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importKamux();
  console.log(`Kamux: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}

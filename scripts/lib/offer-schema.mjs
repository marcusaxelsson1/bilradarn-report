import { equipmentChecks, evaluateCandidate, missingEquipment, passesListingFilters, RANKING_REQUIREMENTS } from "./filters.mjs";
import { normalizeRegNumber } from "./normalize-adapter.mjs";

export const OFFER_FIELDS = [
  "id", "kind", "live", "lifecycle", "title", "variant", "registrationNumber", "vin",
  "priceSek", "modelYear", "mileageMil", "fuelType", "transmission", "bodyType", "color",
  "consumptionL100Km", "annualTaxSek", "malusTaxSek", "dealer", "dealerUrl", "place",
  "distanceKm", "sourceUrl", "sourceOwner", "sourceCheckedAt", "publishedAt", "availability",
  "equipment", "requiredEquipment", "missingRequirements", "imageUrls", "evidence", "quality",
];

export function buildPurchaseOffer(input) {
  const {
    id,
    title,
    variant = null,
    registrationNumber = null,
    vin = null,
    priceSek = null,
    modelYear = null,
    mileageMil = null,
    fuelType = null,
    transmission = null,
    bodyType = null,
    color = null,
    consumptionL100Km = null,
    annualTaxSek = null,
    malusTaxSek = null,
    dealer = null,
    dealerUrl = null,
    place = null,
    distanceKm = null,
    sourceUrl,
    sourceOwner,
    sourceCheckedAt,
    publishedAt = null,
    availability = "unknown",
    equipment = [],
    marketedText = "",
    imageUrls = [],
    lifecycle = "preliminary",
    live = true,
    kind = "purchase",
    passesListingFilters: listingFiltersOverride = null,
  } = input;

  const normalizedReg = normalizeRegNumber(registrationNumber);
  const checks = equipmentChecks(equipment, marketedText);
  const missingRequirements = missingEquipment(checks);
  const rankingMissing = RANKING_REQUIREMENTS.filter((key) => !checks[key]);
  const numeric = {
    priceSek: priceSek != null ? Number(priceSek) : null,
    modelYear: modelYear != null ? Number(modelYear) : null,
    mileageMil: mileageMil != null ? Number(mileageMil) : null,
  };
  const selection = evaluateCandidate({
    title,
    variant,
    priceSek: numeric.priceSek,
    modelYear: numeric.modelYear,
    mileageMil: numeric.mileageMil,
    fuelType,
    transmission,
    bodyType,
    distanceKm,
    availability,
  });

  return {
    id,
    kind,
    live,
    lifecycle,
    title,
    variant,
    registrationNumber: normalizedReg,
    vin: vin ?? null,
    priceSek: numeric.priceSek,
    modelYear: numeric.modelYear,
    mileageMil: numeric.mileageMil,
    fuelType: fuelType ?? null,
    transmission: transmission ?? null,
    bodyType: bodyType ?? null,
    color: color ?? null,
    consumptionL100Km: consumptionL100Km ?? null,
    annualTaxSek: annualTaxSek ?? null,
    malusTaxSek: malusTaxSek ?? null,
    dealer: dealer ?? null,
    dealerUrl: dealerUrl ?? null,
    place: place ?? null,
    distanceKm: distanceKm != null ? Math.round(Number(distanceKm)) : null,
    sourceUrl,
    sourceOwner,
    sourceCheckedAt,
    publishedAt: publishedAt ?? null,
    availability,
    equipment,
    requiredEquipment: checks,
    missingRequirements,
    imageUrls,
    evidence: {
      listing: { status: "verified", sourceUrl, checkedAt: sourceCheckedAt },
      price: { status: numeric.priceSek != null ? "verified" : "missing", sourceUrl, checkedAt: sourceCheckedAt },
      identity: { status: normalizedReg ? "observed" : "missing", sourceUrl, checkedAt: sourceCheckedAt },
      tax: { status: annualTaxSek != null ? "observed" : "missing", sourceUrl, checkedAt: sourceCheckedAt, note: "Exakt registerkontroll återstår" },
      equipment: { status: missingRequirements.length ? "incomplete" : "observed", sourceUrl, checkedAt: sourceCheckedAt },
      economics: { status: "missing", sourceUrl: null, checkedAt: null, note: "Ej rankningsbar före kostnadsberikning" },
    },
    quality: {
      passesListingFilters: listingFiltersOverride ?? passesListingFilters(numeric),
      selection,
      passesRequiredEquipment: rankingMissing.length === 0,
      rankable: false,
      nonBlockingUnverified: missingRequirements.filter((key) => !RANKING_REQUIREMENTS.includes(key)),
      rankBlockers: [
        ...(rankingMissing.length ? [`Saknar annonsbevis för: ${rankingMissing.join(", ")}`] : []),
        "Skatt behöver registerverifieras",
        "Försäkring, service, reparationer, vinterhjul, finansiering och restvärde saknas",
      ],
    },
  };
}

export function buildEnvelope({ source, filters, offers, changes = [], errors = [], sightings = [] }) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "live",
    source,
    filters,
    offers,
    sightings,
    changes,
    errors,
  };
}

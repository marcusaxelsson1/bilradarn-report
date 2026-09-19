export const PRICE_MIN = 0;
export const PRICE_MAX = 250000;
export const MODEL_YEAR_MIN = 2020;
export const MODEL_YEAR_MAX = 2024;
export const MILEAGE_MAX_MIL = 10000;
export const STANDARD_MODEL_YEAR_MIN = 2021;
export const STANDARD_MODEL_YEAR_MAX = 2023;
export const STANDARD_MILEAGE_MAX_MIL = 7500;

export const FAMILY_PATTERNS = [
  /ceed sportswagon|sportage|sorento|niro|corolla touring sports|octavia|superb|karoq|kodiaq|passat|golf sportscombi|golf variant|tiguan|t-roc|touran|arteon.*shooting brake/,
  /v60|v90|xc40|xc60|focus.*(kombi|wagon)|kuga|mondeo|s-max|galaxy|tucson|santa fe|i30.*(kombi|wagon)/,
  /3008|5008|308 sw|508 sw|c5 aircross|megane.*(sport tourer|grandtour)|arkana|austral|koleos|cx-5|mazda 6/,
  /leon.*(sportstourer|st)|ateca|duster|3-serie.*touring|5-serie.*touring|x1|x3|a4.*avant|a6.*avant|q3|q5|c-klass.*(kombi|estate)|e-klass.*(kombi|estate)|gla|glc/,
  /qashqai|x-trail|astra.*sports tourer|insignia|grandland|cr-v|rav4|s-cross|vitara|outback|forester|levorg|lexus nx/,
];

export const REQUIRED_EQUIPMENT = {
  antisladd: [/antisladd/, /stabilitetskontroll/, /electronic stability/, /\besc\b/],
  isofix: [/isofix/],
  parking: [/parkeringssensor/, /park assist/, /parkeringsassist/],
  camera: [/backkamera/, /parkeringskamera/, /360.?kamera/, /\bkamera\b/, /rear.?view.?camera/],
};

export const RANKING_REQUIREMENTS = [];

export function matchesFamily(text = "") {
  const haystack = String(text).toLowerCase();
  return FAMILY_PATTERNS.some((pattern) => pattern.test(haystack));
}

const FAMILY_MODEL_SLUGS = [
  "ceed", "sportage", "sorento", "niro", "corolla", "octavia", "superb", "karoq", "kodiaq", "passat", "golf", "tiguan", "t roc", "touran", "arteon",
  "v60", "v90", "xc40", "xc60", "focus", "kuga", "mondeo", "s max", "galaxy", "tucson", "santa fe", "i30",
  "3008", "5008", "308", "508", "c5 aircross", "megane", "arkana", "austral", "koleos", "cx 5", "mazda 6",
  "leon", "ateca", "duster", "3 serie", "5 serie", "x1", "x3", "a4", "a6", "q3", "q5", "c klass", "e klass", "gla", "glc",
  "qashqai", "x trail", "astra", "insignia", "grandland", "cr v", "rav4", "s cross", "vitara", "outback", "forester", "levorg", "nx",
];
const FAMILY_MODEL_SLUG_PATTERNS = FAMILY_MODEL_SLUGS.map((slug) => new RegExp(`\\b${slug}\\b`));

export function matchesFamilyUrl(url = "") {
  const normalized = decodeURIComponent(String(url)).toLowerCase().replace(/[-_/]+/g, " ");
  return FAMILY_MODEL_SLUG_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function equipmentChecks(labels = [], marketedText = "") {
  const haystack = `${labels.join(" | ")} | ${marketedText}`.toLowerCase();
  return Object.fromEntries(
    Object.entries(REQUIRED_EQUIPMENT).map(([key, patterns]) => [key, patterns.some((pattern) => pattern.test(haystack))]),
  );
}

export function passesListingFilters({ priceSek, modelYear, mileageMil }) {
  const price = priceSek != null ? Number(priceSek) : null;
  const year = modelYear != null ? Number(modelYear) : null;
  const mileage = mileageMil != null ? Number(mileageMil) : null;
  return [
    price == null || (price >= PRICE_MIN && price <= PRICE_MAX),
    year == null || (year >= MODEL_YEAR_MIN && year <= MODEL_YEAR_MAX),
    mileage == null || mileage <= MILEAGE_MAX_MIL,
  ].every(Boolean);
}

export function missingEquipment(checks) {
  return Object.entries(checks).filter(([, present]) => !present).map(([key]) => key);
}

export function classifyFuelType(fuelType = "", text = "") {
  const fuel = String(fuelType ?? "").toLowerCase().trim();
  const combined = `${fuel} ${text}`.toLowerCase();
  if (/^el$|^electric$|batteri(el)?|elbil/.test(fuel) || /\bbev\b/.test(combined)) {
    return { allowed: false, status: "forbidden", reason: "elbil" };
  }
  if (/laddhybrid|plug[ -]?in|\bphev\b|recharge|\bgte\b|tfs[i]?\s*e\b|e-?hybrid|hybrid\s*(225|300)\b/.test(combined)) {
    if (!/utan laddkabel|självladdande|self[ -]?charging|mildhybrid|\bmhev\b/.test(combined)) {
      return { allowed: false, status: "forbidden", reason: "laddhybrid" };
    }
  }
  if (!fuel) return { allowed: true, status: "unknown", reason: "drivmedel saknas" };
  if (/bensin|diesel|petrol|gasoline/.test(fuel)) {
    if (/\+\s*el|el\s*\/\s*bensin|bensin\s*\/\s*el|hybrid/.test(fuel) && !/självladdande|self[ -]?charging|fullhybrid|mildhybrid|\bmhev\b|\bhev\b/.test(combined)) {
      return { allowed: true, status: "verify", reason: "hybridtyp måste verifieras" };
    }
    return { allowed: true, status: "allowed", reason: null };
  }
  if (/mildhybrid|självladdande|self[ -]?charging|fullhybrid|\bmhev\b|\bhev\b/.test(combined)) {
    return { allowed: true, status: "allowed", reason: null };
  }
  if (/hybrid|elhybrid/.test(fuel)) return { allowed: true, status: "verify", reason: "hybridtyp måste verifieras" };
  return { allowed: false, status: "forbidden", reason: `otillåtet drivmedel: ${fuelType}` };
}

export function isAllowedFuelType(fuelType = "", text = "") {
  return classifyFuelType(fuelType, text).allowed;
}

function reasonCount(items) {
  return items.reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});
}

export function evaluateCandidate(candidate = {}) {
  const title = `${candidate.title ?? ""} ${candidate.variant ?? ""}`.trim();
  const price = candidate.priceSek != null ? Number(candidate.priceSek) : null;
  const year = candidate.modelYear != null ? Number(candidate.modelYear) : null;
  const mileage = candidate.mileageMil != null ? Number(candidate.mileageMil) : null;
  const transmission = String(candidate.transmission ?? "").toLowerCase();
  const body = String(candidate.bodyType ?? "").toLowerCase();
  const availability = String(candidate.availability ?? "").toLowerCase();
  const fuel = classifyFuelType(candidate.fuelType, title);
  const rejectReasons = [];
  const exceptionReasons = [];
  const verificationReasons = [];

  if (!matchesFamily(title)) rejectReasons.push("fel storleks-/modellfamilj");
  if (price != null && price > PRICE_MAX) rejectReasons.push("pris över 250 000 kr");
  if (year != null && (year < MODEL_YEAR_MIN || year > MODEL_YEAR_MAX)) rejectReasons.push("årsmodell utanför 2020–2024");
  if (mileage != null && mileage > MILEAGE_MAX_MIL) rejectReasons.push("miltal över 10 000 mil");
  if (!fuel.allowed) rejectReasons.push(fuel.reason);
  if (/sedan|coup|cab|roadster|pickup|transport|skåp|van\b/.test(body)) rejectReasons.push("opraktisk karosstyp");
  if (/unavailable|sold|expired|archived/.test(availability)) rejectReasons.push("inte tillgänglig");

  if (year != null && (year < STANDARD_MODEL_YEAR_MIN || year > STANDARD_MODEL_YEAR_MAX)) exceptionReasons.push("årsmodell utanför normalspannet");
  if (mileage != null && mileage > STANDARD_MILEAGE_MAX_MIL) exceptionReasons.push("miltal över normaltaket 7 500 mil");
  if (/manuell|manual/.test(transmission)) exceptionReasons.push("manuell växellåda");
  if (candidate.distanceKm != null && Number(candidate.distanceKm) > 150) exceptionReasons.push("längre än 150 km från Göteborg");

  if (price == null) verificationReasons.push("pris saknas");
  if (year == null) verificationReasons.push("årsmodell saknas");
  if (mileage == null) verificationReasons.push("miltal saknas");
  if (!transmission) verificationReasons.push("växellåda saknas");
  if (fuel.status === "unknown" || fuel.status === "verify") verificationReasons.push(fuel.reason);
  if (!body) verificationReasons.push("karosstyp saknas");

  return {
    included: rejectReasons.length === 0,
    lane: rejectReasons.length ? "rejected" : exceptionReasons.length ? "exception" : "standard",
    rejectReasons,
    exceptionReasons,
    verificationReasons: [...new Set(verificationReasons.filter(Boolean))],
  };
}

export function summarizeDecisions(decisions = [], extra = {}) {
  return {
    ...extra,
    evaluated: decisions.length,
    included: decisions.filter((decision) => decision.included).length,
    standard: decisions.filter((decision) => decision.lane === "standard").length,
    exception: decisions.filter((decision) => decision.lane === "exception").length,
    rejected: decisions.filter((decision) => !decision.included).length,
    rejectionReasons: reasonCount(decisions.flatMap((decision) => decision.rejectReasons)),
    verificationReasons: reasonCount(decisions.flatMap((decision) => decision.verificationReasons)),
  };
}

export function passesFamilyGate({ title = "", variant = "", priceSek, modelYear, mileageMil, fuelType = "" }) {
  return evaluateCandidate({ title, variant, priceSek, modelYear, mileageMil, fuelType }).included;
}

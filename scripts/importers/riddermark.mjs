import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, parseUrlsetUrls, writeSourceFile, buildDealerEnvelope, mapConcurrent, filterCandidates } from "../lib/adapter-base.mjs";
import { extractNextData, normalizeRegNumber } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";

const ORIGIN = "https://www.riddermarkbil.se";
const SITEMAP_ADVERTS = `${ORIGIN}/server-sitemap-adverts.xml`;
const SOURCE_KEY = "riddermark";

export function extractAdvertJson(html) {
  const data = extractNextData(html);
  const advert = data?.props?.pageProps?.advertJson;
  if (!advert) throw new Error("Riddermarks advertJson saknas i __NEXT_DATA__");
  return advert;
}

export function extractListCars(html) {
  const data = extractNextData(html);
  return data?.props?.pageProps?.carsJson ?? [];
}

export function discoverDetailUrls(sitemapXml) {
  return [...new Set(parseUrlsetUrls(sitemapXml).filter((url) => /\/kopa-bil\/[^/]+\/[^/]+\/?$/.test(url)))];
}

function listCandidate(advert) {
  return {
    title: advert.title ?? advert.carName ?? [advert.make, advert.model].filter(Boolean).join(" "),
    variant: [advert.carName, advert.modelDescription, advert.series].filter(Boolean).join(" "),
    registrationNumber: normalizeRegNumber(advert.licenseplate),
    priceSek: advert.price ?? null,
    modelYear: advert.modelYear ?? null,
    mileageMil: advert.mileage ?? null,
    fuelType: advert.fuelType ?? null,
    transmission: advert.gearboxType ?? null,
    bodyType: advert.carType ?? null,
    availability: advert.isSold ? "unavailable" : "available",
  };
}

export async function discoverListCars({ maxPages = 100 } = {}) {
  const cars = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const pageCars = extractListCars(await fetchText(`${ORIGIN}/kopa-bil/?forSale=true&page=${page}`));
    if (!pageCars.length) break;
    let added = 0;
    for (const car of pageCars) {
      const key = normalizeRegNumber(car.licenseplate) ?? String(car.id);
      if (!cars.has(key)) added += 1;
      cars.set(key, car);
    }
    if (pageCars.length < 39 || added === 0) break;
  }
  return [...cars.values()];
}

export function normalizeDetail(url, html, checkedAt = new Date().toISOString()) {
  const advert = extractAdvertJson(html);
  const equipment = [
    ...(advert.equipment ?? []),
    ...(advert.sellingPoints ?? []),
    ...(advert.attributes ?? []).map((attribute) => attribute.description).filter(Boolean),
  ];
  const images = (advert.images ?? []).map((image) => image.originalImageUrl ?? image.url).filter(Boolean);
  const reg = normalizeRegNumber(advert.licenseplate);
  const title = advert.title ?? advert.carName ?? [advert.make, advert.model].filter(Boolean).join(" ");
  const variant = advert.carName ?? [advert.make, advert.model].filter(Boolean).join(" ");
  const sold = Boolean(advert.isSold) || /såld/i.test(String(advert.status ?? ""));

  return buildPurchaseOffer({
    id: `riddermark:${reg ?? advert.id ?? url}`,
    title,
    variant,
    registrationNumber: reg,
    vin: advert.vinNumber ?? null,
    priceSek: advert.price ?? null,
    modelYear: advert.modelYear ?? null,
    mileageMil: advert.mileage ?? null,
    fuelType: advert.fuelType ?? null,
    transmission: advert.gearboxType ?? null,
    bodyType: advert.carType ?? null,
    dealer: "Riddermark Bil",
    place: typeof advert.location === "object" ? advert.location?.name ?? advert.location?.area ?? null : advert.location ?? null,
    sourceUrl: url,
    sourceOwner: "Riddermark Bil",
    sourceCheckedAt: checkedAt,
    publishedAt: advert.publishedAt ?? null,
    availability: sold ? "unavailable" : "unknown",
    equipment,
    marketedText: [variant, ...equipment].join(" "),
    imageUrls: images,
    lifecycle: "preliminary",
  });
}

export async function importRiddermark({ detailLimit = Infinity, maxPages = 100 } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  let detailUrls = [];
  let cars = [];
  try {
    const [sitemapXml, listCars] = await Promise.all([fetchText(SITEMAP_ADVERTS), discoverListCars({ maxPages })]);
    detailUrls = discoverDetailUrls(sitemapXml);
    cars = listCars;
  } catch (error) {
    errors.push({ url: `${ORIGIN}/kopa-bil/`, message: error.message });
  }
  const urlByReg = new Map(detailUrls.map((url) => [normalizeRegNumber(new URL(url).pathname.split("/").filter(Boolean).pop()), url]));
  const listCandidates = cars.map((car) => ({ car, ...listCandidate(car) }));
  const prefilter = filterCandidates(listCandidates, { discovered: listCandidates.length });
  const selected = prefilter.included
    .map((candidate) => ({ candidate, url: urlByReg.get(candidate.registrationNumber) }))
    .filter(({ url }) => url)
    .slice(0, detailLimit);
  const normalized = [];
  await mapConcurrent(selected, 6, async ({ url }) => {
    try {
      const offer = normalizeDetail(url, await fetchText(url), checkedAt);
      normalized.push(offer);
    } catch (error) {
      errors.push({ url, message: error.message });
    }
  });

  const final = filterCandidates(normalized, {
    discovered: listCandidates.length,
    prefiltered: selected.length,
    detailPagesRequested: selected.length,
    prefilterRejected: prefilter.funnel.rejected,
    prefilterRejectionReasons: prefilter.funnel.rejectionReasons,
  });
  const result = buildDealerEnvelope({ key: SOURCE_KEY, name: "Riddermark Bil", role: "Handlaradapter för Riddermarks publika begagnadlager", checkedAt, offers: final.included, errors, extraSource: { sitemap: SITEMAP_ADVERTS, list: `${ORIGIN}/kopa-bil/`, funnel: final.funnel } });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importRiddermark();
  console.log(`Riddermark: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}

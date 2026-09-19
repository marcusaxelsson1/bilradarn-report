import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, writeSourceFile, buildDealerEnvelope, mapConcurrent, filterCandidates } from "../lib/adapter-base.mjs";
import { decodeHtml, extractDefinitionPairs, extractListItemTexts, extractMetaContent, findPair, normalizeRegNumber, numberFromText } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";

const ORIGIN = "https://www.niemibil.se";
const LIST_URL = `${ORIGIN}/begagnade-bilar/`;
const SOURCE_KEY = "niemi";

export function extractListCars(html) {
  const cars = [];
  for (const match of html.matchAll(/<article[^>]+class="[^"]*car-item[^"]*"[^>]*data-regno="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const article = match[0];
    const id = article.match(/car-item-id-(\d+)/)?.[1] ?? article.match(/id="car-(\d+)"/)?.[1] ?? null;
    const dataPrice = article.match(/data-price="([^"]+)"/)?.[1] ?? null;
    const href = article.match(/<a[^>]+href="([^"]+)"/)?.[1] ?? null;
    const description = decodeHtml(article.match(/itemprop="description"[^>]+content="([^"]+)"/)?.[1] ?? article.match(/content="([^"]+)"[^>]+itemprop="description"/)?.[1] ?? "");
    const year = numberFromText(description.match(/(?:^|,\s*)(20\d{2})(?:,|$)/)?.[1]);
    const mileage = numberFromText(description.match(/([\d\s]+)\s*mil\b/i)?.[1]);
    const fuel = description.match(/(?:^|,\s*)(Bensin|Diesel|El|Laddhybrid|Hybrid|Elhybrid|Mildhybrid)(?:\s*,|$)/i)?.[1] ?? null;
    const title = description.replace(/,\s*20\d{2}\s*,.*$/i, "").trim();
    cars.push({ regNo: match[1], id, price: dataPrice ? numberFromText(dataPrice) : null, url: href, title, modelYear: year, mileageMil: mileage, fuelType: fuel });
  }
  return cars;
}

export function extractFacts(html) {
  return extractDefinitionPairs(html);
}

export function extractEquipment(html) {
  return extractListItemTexts(html);
}

export function extractGalleryImages(html) {
  const match = html.match(/<script[^>]+data-gallery-images[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    return (Array.isArray(data) ? data : []).map((item) => item?.src).filter(Boolean);
  } catch {
    return [];
  }
}

function titleFromSlug(url) {
  try {
    const segment = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "";
    return decodeHtml(segment).replace(/[-_]/g, " ");
  } catch {
    return "Niemi bil";
  }
}

export function normalizeDetail(url, html, { listRegNo = null, checkedAt = new Date().toISOString() } = {}) {
  const pairs = extractFacts(html);
  const title = extractMetaContent(html, "og:rule_title") ?? extractMetaContent(html, "og:title") ?? titleFromSlug(url);
  const priceSek = numberFromText(extractMetaContent(html, "og:rule_price")) ?? numberFromText(findPair(pairs, /pris/i));
  const reg = normalizeRegNumber(listRegNo ?? findPair(pairs, /^registreringsnummer$/i));
  const equipment = extractEquipment(html);
  const imageUrls = extractGalleryImages(html);

  return buildPurchaseOffer({
    id: `niemi:${reg ?? titleFromSlug(url)}`,
    title,
    variant: null,
    registrationNumber: reg,
    vin: findPair(pairs, /^vin$/i),
    priceSek,
    modelYear: numberFromText(findPair(pairs, /modellår/i)),
    mileageMil: numberFromText(findPair(pairs, /mätarställning/i)),
    fuelType: findPair(pairs, /drivmedel/i),
    transmission: findPair(pairs, /växellåda/i),
    bodyType: findPair(pairs, /kaross/i),
    dealer: "Niemi Bil",
    place: findPair(pairs, /ort|anläggning/i),
    sourceUrl: url,
    sourceOwner: "Niemi Bil",
    sourceCheckedAt: checkedAt,
    availability: /såld/i.test(title) ? "unavailable" : "unknown",
    equipment,
    marketedText: [title, ...equipment].join(" "),
    imageUrls,
    lifecycle: "preliminary",
  });
}

export async function importNiemi({ pages = 40, detailLimit = Infinity } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  const byReg = new Map();
  for (let page = 1; page <= pages; page += 1) {
    let html;
    try {
      html = await fetchText(`${LIST_URL}?pg=${page}`);
    } catch (error) {
      errors.push({ url: `${LIST_URL}?pg=${page}`, message: error.message });
      break;
    }
    const cars = extractListCars(html);
    if (!cars.length) break;
    for (const car of cars) byReg.set(normalizeRegNumber(car.regNo) ?? car.id ?? car.regNo, car);
  }

  const listCandidates = [...byReg.entries()].map(([reg, car]) => ({
    reg,
    title: car.title,
    priceSek: car.price,
    modelYear: car.modelYear,
    mileageMil: car.mileageMil,
    fuelType: car.fuelType,
    url: car.url ? new URL(car.url, ORIGIN).href : `${ORIGIN}/objekt/${encodeURIComponent(reg.toLowerCase())}/`,
  }));
  const prefilter = filterCandidates(listCandidates, { discovered: listCandidates.length });
  const entries = prefilter.included.slice(0, detailLimit);
  const normalized = [];
  await mapConcurrent(entries, 6, async ({ reg, url }) => {
    try {
      const offer = normalizeDetail(url, await fetchText(url), { listRegNo: reg, checkedAt });
      normalized.push(offer);
    } catch (error) {
      errors.push({ url, message: error.message });
    }
  });

  const final = filterCandidates(normalized, {
    discovered: listCandidates.length,
    prefiltered: entries.length,
    detailPagesRequested: entries.length,
    prefilterRejected: prefilter.funnel.rejected,
    prefilterRejectionReasons: prefilter.funnel.rejectionReasons,
  });
  const result = buildDealerEnvelope({ key: SOURCE_KEY, name: "Niemi Bil", role: "Handlaradapter för Niemis publika begagnadlager", checkedAt, offers: final.included, errors, extraSource: { listUrl: LIST_URL, funnel: final.funnel } });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importNiemi();
  console.log(`Niemi: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}

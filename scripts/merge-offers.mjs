import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRegNumber } from "./lib/normalize-adapter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORTERS_DIR = resolve(ROOT, "src/data/importers");
const WAYKE_FILE = resolve(IMPORTERS_DIR, "wayke.json");
const OUTPUT = resolve(ROOT, "src/data/live-offers.json");
const STATE = resolve(ROOT, "data/merge-state.json");

export function canonicalKey(offer) {
  const reg = normalizeRegNumber(offer.registrationNumber);
  return reg ? `reg:${reg}` : `id:${offer.id}`;
}

function contentHash(offer) {
  const reg = normalizeRegNumber(offer.registrationNumber) ?? "";
  const payload = [reg, offer.priceSek, offer.mileageMil, offer.title].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function sourceOf(offer) {
  const idx = String(offer.id ?? "").indexOf(":");
  return idx > 0 ? offer.id.slice(0, idx) : "unknown";
}

function pickWinner(candidates) {
  if (candidates.length === 1) return candidates[0];
  const dealers = candidates.filter((candidate) => candidate.isDealer);
  const pool = dealers.length ? dealers : candidates;
  return [...pool].sort((a, b) => {
    const aTime = Date.parse(a.offer.sourceCheckedAt ?? 0) || 0;
    const bTime = Date.parse(b.offer.sourceCheckedAt ?? 0) || 0;
    return bTime - aTime;
  })[0];
}

function detectCanonicalChanges(previousOffers, offers) {
  const before = new Map(previousOffers.map((offer) => [canonicalKey(offer), offer]));
  const after = new Map(offers.map((offer) => [canonicalKey(offer), offer]));
  const changes = [];
  for (const offer of offers) {
    const key = canonicalKey(offer);
    const old = before.get(key);
    if (!old) changes.push({ type: "new", id: offer.id, title: offer.title, registrationNumber: normalizeRegNumber(offer.registrationNumber), at: offer.sourceCheckedAt });
    else if (old.priceSek !== offer.priceSek) changes.push({ type: "price", id: offer.id, title: offer.title, registrationNumber: normalizeRegNumber(offer.registrationNumber), before: old.priceSek, after: offer.priceSek, at: offer.sourceCheckedAt });
  }
  for (const offer of previousOffers) {
    const key = canonicalKey(offer);
    if (!after.has(key)) changes.push({ type: "not-in-current-sample", id: offer.id, title: offer.title, registrationNumber: normalizeRegNumber(offer.registrationNumber), at: new Date().toISOString() });
  }
  return changes;
}

export function mergeOffers(waykeFeed, dealerFeeds = [], { previousOffers = [], previousSightings = [] } = {}) {
  const feeds = [
    { key: "wayke", isDealer: false, feed: waykeFeed },
    ...dealerFeeds.map((feed) => ({ key: feed?.source?.key ?? sourceOf(feed?.offers?.[0] ?? { id: "unknown" }), isDealer: true, feed })),
  ];

  const groups = new Map();
  const previousBySightingId = new Map(previousSightings.map((sighting) => [sighting.sightingId, sighting]));

  function consider(offer, sourceKey, isDealer) {
    const key = canonicalKey(offer);
    const group = groups.get(key) ?? { key, candidates: [] };
    group.candidates.push({ offer, sourceKey, isDealer });
    groups.set(key, group);
  }

  for (const { key, feed, isDealer } of feeds) {
    for (const offer of feed?.offers ?? []) consider(offer, key, isDealer);
  }

  const offers = [];
  const sightings = [];
  const now = new Date().toISOString();

  for (const group of groups.values()) {
    const winner = pickWinner(group.candidates);
    offers.push(winner.offer);
    for (const { offer, sourceKey } of group.candidates) {
      const vehicleId = offer.id.includes(":") ? offer.id.slice(offer.id.indexOf(":") + 1) : offer.id;
      const sightingId = `${sourceKey}:${vehicleId}`;
      const previous = previousBySightingId.get(sightingId);
      const sighting = {
        sightingId,
        reg: normalizeRegNumber(offer.registrationNumber) ?? null,
        source: sourceKey,
        sourceVehicleId: vehicleId,
        sourceUrl: offer.sourceUrl,
        priceSek: offer.priceSek,
        mileageMil: offer.mileageMil,
        firstSeenAt: previous?.firstSeenAt ?? offer.sourceCheckedAt ?? now,
        lastSeenAt: offer.sourceCheckedAt ?? now,
        contentHash: contentHash(offer),
      };
      sightings.push(sighting);
    }
  }

  const changes = detectCanonicalChanges(previousOffers, offers);
  return { offers, sightings, changes };
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

export async function mergeCatalog() {
  const waykeFeed = await readJson(WAYKE_FILE);
  if (!waykeFeed) throw new Error("Waykes källfil saknas; kör data:import först.");

  let names = [];
  try { names = (await readdir(IMPORTERS_DIR)).filter((name) => name.endsWith(".json") && name !== "wayke.json"); } catch { names = []; }

  const dealerFeeds = [];
  for (const name of names) {
    const feed = await readJson(resolve(IMPORTERS_DIR, name));
    if (feed) dealerFeeds.push({ ...feed, source: { ...(feed.source ?? {}), key: feed.source?.key ?? name.replace(/\.json$/, "") } });
  }

  const state = (await readJson(STATE)) ?? { offers: [], sightings: [] };
  const { offers, sightings, changes } = mergeOffers(waykeFeed, dealerFeeds, {
    previousOffers: state.offers ?? [],
    previousSightings: state.sightings ?? [],
  });

  const detailPagesRead = (waykeFeed.source?.detailPagesRead ?? 0) + dealerFeeds.reduce((total, feed) => total + (feed.source?.detailPagesRead ?? 0), 0);
  const errors = [
    ...(waykeFeed.errors ?? []),
    ...dealerFeeds.flatMap((feed) => (feed.errors ?? []).map((error) => ({ ...error, source: feed.source?.key ?? "unknown" }))),
  ];

  const envelope = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "live",
    source: {
      name: "Wayke + handlaradaptrar",
      role: "Sammanslagen köpkatalog, deduplicerad på registreringsnummer",
      searchUrl: waykeFeed.source?.searchUrl ?? null,
      reportedHits: waykeFeed.source?.reportedHits ?? 0,
      documentsRead: waykeFeed.source?.documentsRead ?? 0,
      detailPagesRead,
      sources: [
        { key: "wayke", name: waykeFeed.source?.name ?? "Wayke", offers: waykeFeed.offers?.length ?? 0 },
        ...dealerFeeds.map((feed) => ({ key: feed.source?.key ?? "unknown", name: feed.source?.name ?? feed.source?.key ?? "unknown", offers: feed.offers?.length ?? 0 })),
      ],
    },
    filters: waykeFeed.filters ?? {},
    offers,
    sightings,
    changes,
    errors,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  await writeFile(STATE, `${JSON.stringify({ offers, sightings }, null, 2)}\n`, "utf8");
  return envelope;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envelope = await mergeCatalog();
  console.log(`Merge klar: ${envelope.offers.length} unika bilar från ${envelope.source.sources.length} källor.`);
  console.log(`${envelope.changes.length} förändringar, ${envelope.sightings.length} observationer.`);
}

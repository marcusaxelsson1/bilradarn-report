import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = resolve(ROOT, "src/data/report.json");
const PUBLIC = resolve(ROOT, "public/car-images");
const MANIFEST = resolve(ROOT, "src/data/image-cache.json");
const clean = (value) => String(value).replace(/[^a-z0-9_-]/gi, "-").slice(0, 90);

async function download(url, destination) {
  const requestUrl = url.startsWith("https://cdn.wayke.se/") && !url.includes("?") ? `${url}?format=jpeg&w=1600` : url;
  const response = await fetch(requestUrl, { headers: { "user-agent": "Bilradarn/1.0 private research image cache" }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${response.status} från ${url}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

export async function cacheImages() {
  const report = JSON.parse(await readFile(INPUT, "utf8"));
  const offers = [...report.purchases, ...report.leases];
  let previousManifest = {};
  try { previousManifest = JSON.parse(await readFile(MANIFEST, "utf8")).offers || {}; } catch { /* first cache run */ }
  const manifest = {};
  let downloaded = 0, failed = 0;
  const batches = [];
  for (let i = 0; i < offers.length; i += 4) batches.push(offers.slice(i, i + 4));
  for (const batch of batches) await Promise.all(batch.map(async (offer) => {
    const folder = resolve(PUBLIC, clean(offer.id));
    await mkdir(folder, { recursive: true });
    const local = [];
    await Promise.all([...new Set(offer.imageUrls || [])].map(async (url, index) => {
      if (url.startsWith("/car-images/")) {
        const filePath = resolve(ROOT, "public", url.replace(/^\//, ""));
        try {
          await stat(filePath);
          const prior = previousManifest[offer.id]?.find((item) => item.path === url);
          local[index] = prior ? { ...prior, path: url } : { url, path: url };
          return;
        } catch { /* stale local path; continue without it */ }
      }
      const extension = /\.png/i.test(url) ? "png" : "jpg";
      const file = `${String(index + 1).padStart(2, "0")}.${extension}`;
      try {
        // Match by URL first, then by stable image index for manifests created
        // before original URLs were preserved.
        const existing = previousManifest[offer.id]?.find((item) => item.url === url)
          ?? previousManifest[offer.id]?.[index];
        if (!existing) await download(url, resolve(folder, file));
        else {
          const info = await stat(resolve(ROOT, "public", existing.path.replace(/^\//, "")));
          if (info.size > 5 * 1024 * 1024) await download(url, resolve(folder, file));
        }
        local[index] = { url, path: `/car-images/${clean(offer.id)}/${file}` };
        downloaded += 1;
      } catch { failed += 1; }
    }));
    manifest[offer.id] = local.filter(Boolean);
  }));
  await writeFile(MANIFEST, `${JSON.stringify({ generatedAt: new Date().toISOString(), downloaded, failed, offers: manifest }, null, 2)}\n`, "utf8");
  for (const offer of offers) {
    const cached = manifest[offer.id] || [];
    if (cached.length) offer.imageUrls = cached.map((item) => item.path);
  }
  await writeFile(INPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { downloaded, failed, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cacheImages();
  console.log(`Bildcache: ${result.downloaded} sparade lokalt, ${result.failed} kunde inte hämtas.`);
}

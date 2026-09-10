import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSharedBenchmarks, offerBrand, parseHedvigMonthly, parseMekonomenSwap, tyreSearchUrl } from "./lib/cost-source-adapters.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = resolve(ROOT, "data/research-queue.json");
const REGISTRY = resolve(ROOT, "src/data/registry-public.json");
const FINDINGS = resolve(ROOT, "data/research-findings");
const clean = (value) => String(value).replace(/[^a-z0-9_-]/gi, "-");

const readJson = async (path, fallback = {}) => {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
};

function registryDimension(registry, registrationNumber) {
  const record = registry[String(registrationNumber ?? "").toUpperCase()];
  const field = record?.fields?.find((item) => /däckdimension/i.test(item.label));
  return field?.value ?? null;
}

export async function researchCosts() {
  const queue = await readJson(QUEUE, { tasks: [] });
  const registry = await readJson(REGISTRY);
  const shared = await fetchSharedBenchmarks();
  const swap = shared.mekonomen.html ? parseMekonomenSwap(shared.mekonomen.html) : null;
  let written = 0;
  await mkdir(FINDINGS, { recursive: true });

  for (const task of queue.tasks ?? []) {
    const path = resolve(FINDINGS, `${clean(task.id)}.json`);
    const previous = await readJson(path);
    const brand = offerBrand(task.title);
    const monthly = shared.hedvig.html ? parseHedvigMonthly(shared.hedvig.html, brand) : null;
    const dimension = registryDimension(registry, task.registrationNumber);
    const tyreUrl = tyreSearchUrl(dimension);
    const next = {
      ...previous,
      offerId: task.id,
      sourceUrl: previous.sourceUrl ?? task.sourceUrl,
      checkedAt: shared.checkedAt,
      status: "partially_verified",
      costs: {
        ...(previous.costs ?? {}),
        insurance: monthly ? {
          amountSek: monthly * 36,
          status: "estimated",
          sourceUrl: shared.hedvig.url,
          checkedAt: shared.checkedAt,
          note: `Hedvigs offentliga snitt för helförsäkring: ${monthly} kr/mån${brand ? ` (${brand})` : " (Västra Götaland/helförsäkring)"}. Inte personlig offert.`,
        } : previous.costs?.insurance ?? { amountSek: null, status: "unknown", sourceUrl: shared.hedvig.url, note: shared.hedvig.error ?? "Riktvärdet kunde inte läsas." },
      },
      evidence: {
        ...(previous.evidence ?? {}),
        tyreSwap: swap ? { status: "estimated", sourceUrl: shared.mekonomen.url, checkedAt: shared.checkedAt, note: `Mekonomen anger däckbyte från ${swap} kr; bilspecifikt pris kräver bokning hos vald verkstad.` } : { status: "unknown", sourceUrl: shared.mekonomen.url, checkedAt: shared.checkedAt, note: shared.mekonomen.error ?? "Pris kunde inte läsas." },
        tyreSearch: tyreUrl ? { status: "partially_verified", sourceUrl: tyreUrl, checkedAt: shared.checkedAt, note: `Däckdimension ${dimension}; exakt setpris beror på valt fabrikat, säsong och lagerstatus.` } : { status: "unknown", sourceUrl: "https://www.dackonline.se/", checkedAt: shared.checkedAt, note: "Däckdimension saknas i sanerad registerdata." },
      },
    };
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    written += 1;
  }
  return { written, insuranceSourceAvailable: Boolean(shared.hedvig.html), mekonomenSourceAvailable: Boolean(shared.mekonomen.html), swap };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await researchCosts();
  console.log(`Kostnadsagent: ${result.written} fynd uppdaterade. Hedvig=${result.insuranceSourceAvailable ? "ok" : "saknas"}, Mekonomen=${result.mekonomenSourceAvailable ? "ok" : "saknas"}.`);
}


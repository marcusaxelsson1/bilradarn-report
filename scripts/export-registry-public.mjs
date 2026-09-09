import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { extractRegistryFields, knownRegistryValues } from "./lib/registry-parser.mjs";

const root = process.cwd();
const rawDir = path.join(root, "data", "registry-results", "raw");
const output = path.join(root, "src", "data", "registry-public.json");
const privateLabels = /^(Namn|Adress|Postnr|Ort|Producentansvarig)$/i;
const result = {};
if (existsSync(rawDir)) for (const file of readdirSync(rawDir).filter((name) => name.endsWith(".json"))) {
  try {
    const archive = JSON.parse(readFileSync(path.join(rawDir, file), "utf8"));
    const text = archive.snapshots?.map((snapshot) => snapshot.text || "").join("\n") || archive.rawText || "";
    const registrationNumber = archive.registrationNumber || file.replace(/\.json$/i, "");
    const fields = extractRegistryFields(text).filter((field) => !privateLabels.test(field.label));
    result[registrationNumber] = { registrationNumber, ...knownRegistryValues(text), fields, evidence: { status: "verified", sourceUrl: "https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/", checkedAt: archive.capturedAt || null } };
  } catch { /* ignore malformed local archive */ }
}
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(`Exported ${Object.keys(result).length} public registry records.`);

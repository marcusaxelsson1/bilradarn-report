import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { chromium } from "playwright";
import { extractRegistryFields, knownRegistryValues } from "./lib/registry-parser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = resolve(ROOT, "data/registry-results");
const SEARCH_URL = "https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/";
const registration = process.argv.slice(2).find((arg) => arg.startsWith("--registration="))?.split("=").slice(1).join("=")?.replace(/[^a-z0-9]/gi, "").toUpperCase();
if (!registration) throw new Error("Ange --registration=ABC123");

const browser = await chromium.launch({ headless: false, channel: process.env.BILRADARN_BROWSER_CHANNEL || undefined, executablePath: process.env.BILRADARN_BROWSER_PATH || undefined });
const page = await browser.newPage();
await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
const input = page.locator("input:visible").first();
await input.fill(registration);
const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question("Klicka själv på ‘Sök fordonsuppgifter’ i webbläsaren. Lös eventuell säkerhetskontroll manuellt och tryck Enter här när sidan visar uppgifterna: ");
const rawText = await page.locator("body").innerText();
const result = {
  registrationNumber: registration,
  ...knownRegistryValues(rawText),
  fields: extractRegistryFields(rawText),
  technical: {},
  rawText,
  evidence: { status: "partially_verified", sourceUrl: SEARCH_URL, checkedAt: new Date().toISOString(), note: "Synlig sida bekräftad av användaren; fält utan entydig etikett lämnas tomma." },
};
await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(resolve(OUTPUT_DIR, `${registration}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await rl.close();
await browser.close();
console.log(`Sparade registerresultat i data/registry-results/${registration}.json`);

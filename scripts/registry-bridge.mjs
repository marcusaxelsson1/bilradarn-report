import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { extractRegistryFields, knownRegistryValues } from "./lib/registry-parser.mjs";

const PORT = Number(process.env.BILRADARN_BRIDGE_PORT || 8787);
const SEARCH_URL = "https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/";
const RAW_DIR = resolve(process.cwd(), "data/registry-results/raw");
let browser;
let page;
let currentRegistration;

const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Methods": "GET, OPTIONS" }); res.end(JSON.stringify(body)); };
const numberAfter = (text, patterns) => { for (const pattern of patterns) { const match = text.match(pattern); if (match) return Number(match[1].replace(/\s/g, "")); } return null; };
const textAfter = (text, patterns) => { for (const pattern of patterns) { const match = text.match(pattern); if (match) return match[1].trim(); } return null; };

function browserOptions() {
  if (process.env.BILRADARN_BROWSER_PATH) return { executablePath: process.env.BILRADARN_BROWSER_PATH };
  if (process.env.BILRADARN_BROWSER_CHANNEL) return { channel: process.env.BILRADARN_BROWSER_CHANNEL };
  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const executablePath = edgePaths.find((candidate) => existsSync(candidate));
  return executablePath ? { executablePath } : {};
}

async function start(registration) {
  if (!registration) throw new Error("Registreringsnummer saknas");
  if (!browser) browser = await chromium.launch({ headless: false, ...browserOptions() });
  if (!page || page.isClosed()) page = await browser.newPage();
  currentRegistration = registration;
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
  await page.locator("input:visible").first().fill(registration);
  return { ok: true, registration };
}

async function capture() {
  if (!page || page.isClosed() || !currentRegistration) throw new Error("Ingen aktiv registerkontroll");
  let showAll = page.getByRole("button", { name: "Visa alla uppgifter", exact: true }).first();
  if (!await showAll.count()) showAll = page.getByText("Visa alla uppgifter", { exact: true }).first();
  let expandedAll = false;
  if (await showAll.count()) { try { await showAll.click(); await page.waitForTimeout(900); expandedAll = true; } catch { /* sidan kan redan vara expanderad */ } }
  if (!expandedAll) { expandedAll = await page.locator("button,input[type=button],a,summary").evaluateAll((elements) => { const target = elements.find((element) => element.textContent?.trim() === "Visa alla uppgifter" || element.value?.trim() === "Visa alla uppgifter"); if (target) { target.click(); return true; } return false; }); if (expandedAll) await page.waitForTimeout(900); }
  const frameCaptures = await Promise.all(page.frames().map(async (frame) => ({ url: frame.url(), text: await frame.locator("body").innerText().catch(() => ""), html: await frame.content().catch(() => "") })));
  const captures = [{ tab: "Sammanfattning", text: await page.locator("body").innerText(), html: await page.content(), frames: frameCaptures }];
  const missingTabs = [];
  for (const tabName of (expandedAll ? [] : ["Ägare/brukare", "Fordonsidentitet", "Status", "Besiktning", "Skatt och avgifter", "Tekniska data"])) {
    let link = page.locator("summary,a,button,[role=tab]").filter({ hasText: new RegExp(`^\\s*${tabName}\\s*$`, "i") }).first();
    if (!await link.count()) link = page.getByText(tabName, { exact: true }).first();
    if (!await link.count()) { missingTabs.push(tabName); continue; }
    try { await link.click(); await page.waitForLoadState({ state: "domcontentloaded", timeoutMs: 2000 }).catch(() => {}); await page.waitForTimeout(500); captures.push({ tab: tabName, text: await page.locator("body").innerText(), html: await page.content(), frames: await Promise.all(page.frames().map(async (frame) => ({ url: frame.url(), text: await frame.locator("body").innerText().catch(() => ""), html: await frame.content().catch(() => "") })))}); } catch { missingTabs.push(tabName); }
  }
  const rawText = captures.map((item) => `--- ${item.tab} ---\\n${item.text}\\n${item.frames?.map((frame) => frame.text).join("\\n") || ""}`).join("\\n");
  if (/säkerhetskontroll|sök med registreringsnummer/i.test(rawText) && !/fordonsuppgifter|årsmodell|fordonsskatt/i.test(rawText)) {
    throw new Error("Transportstyrelsen visar ännu inget resultat. Klicka på sök och lös eventuell säkerhetskontroll först.");
  }
  const html = captures.map((item) => `<!-- ${item.tab} -->\\n${item.html}\\n${item.frames?.map((frame) => `<!-- iframe ${frame.url} -->\\n${frame.html}`).join("\\n") || ""}`).join("\\n");
  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(resolve(RAW_DIR, `${currentRegistration}.json`), JSON.stringify({ registrationNumber: currentRegistration, capturedAt: new Date().toISOString(), snapshots: captures }, null, 2), "utf8");
  const fullDataVisible = /antal brukare|förvärvsdatum|försäkringsbolag/i.test(rawText);
  return { registrationNumber: currentRegistration, ...knownRegistryValues(rawText), fields: extractRegistryFields(rawText), rawText, html, evidence: { status: missingTabs.length || !fullDataVisible ? "partially_verified" : "verified", sourceUrl: SEARCH_URL, checkedAt: new Date().toISOString(), tabsCaptured: captures.map((item) => item.tab), missingTabs: [...missingTabs, ...(!fullDataVisible ? ["Visa alla uppgifter gav inget utökat innehåll"] : [])], rawArchive: `data/registry-results/raw/${currentRegistration}.json`, note: "Synliga Transportstyrelse-flikar fångade efter användarens manuella sökning." } };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/health") return json(res, 200, { ok: true, browser: Boolean(browser) });
    if (url.pathname === "/start") return json(res, 200, await start((url.searchParams.get("registration") || "").replace(/[^a-z0-9]/gi, "").toUpperCase()));
    if (url.pathname === "/capture") return json(res, 200, await capture());
    return json(res, 404, { error: "Not found" });
  } catch (error) { return json(res, 500, { error: error.message }); }
});
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.warn(`Bilradarn registry bridge körs redan på http://127.0.0.1:${PORT}; återanvänder den befintliga processen.`);
    return;
  }
  throw error;
});
server.listen(PORT, "127.0.0.1", () => console.log(`Bilradarn registry bridge lyssnar på http://127.0.0.1:${PORT}`));

import { chromium } from "playwright";

const CHROMIUM_CANDIDATES = [
  process.env.BILRADARN_CHROMIUM,
  "C:/Users/Marcus/AppData/Local/ms-playwright/chromium-1232/chrome-win64/chrome.exe",
  "C:/Users/Marcus/AppData/Local/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-win64/chrome-headless-shell.exe",
].filter(Boolean);

export async function launchBrowser() {
  for (const exe of CHROMIUM_CANDIDATES) {
    try { return await chromium.launch({ headless: true, executablePath: exe }); } catch { /* try next */ }
  }
  return chromium.launch({ headless: true });
}

async function dismissCookies(page) {
  for (const text of ["Allow all", "Acceptera alla", "Tillåt alla", "Godkänn", "Acceptera"]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    try { if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); await page.waitForTimeout(500); return; } } catch { /* next */ }
  }
  await page.evaluate(() => {
    document.querySelectorAll("#onetrust-consent-sdk, .onetrust-pc-dark-filter, [data-nosnippet]").forEach((el) => el.remove());
  });
}

export async function discoverKamuxUrls({ maxPages = 50 } = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const urls = new Set();
  try {
    for (let p = 1; p <= maxPages; p += 1) {
      await page.goto(`https://www.kamux.se/search?page=${p}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1800);
      const links = await page.$$eval('a[href*="/cars/"]', (els) => els.map((e) => e.getAttribute("href")));
      if (!links.length) break;
      let added = 0;
      for (const link of links) {
        const abs = new URL(link, "https://www.kamux.se").href;
        if (!urls.has(abs)) { urls.add(abs); added += 1; }
      }
      if (added === 0) break;
    }
  } finally {
    await page.close();
    await browser.close();
  }
  return [...urls];
}

export async function discoverDinBilCards({ maxClicks = 40 } = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto("https://dinbil.se/bilar-i-lager/begagnat", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);
    await dismissCookies(page);
    for (let i = 0; i < maxClicks; i += 1) {
      const btn = page.locator('button:has-text("Visa fler")').first();
      try { await btn.click({ timeout: 4000 }); } catch { break; }
      await page.waitForTimeout(1200);
    }
    const cards = await page.evaluate(() => [...document.querySelectorAll('a[href*="/bilar-i-lager/begagnat/"]')].map((a) => {
      const card = a.closest(".list-car-card") ?? a;
      const regMatch = a.getAttribute("href").match(/\/begagnat\/([a-z0-9]+)\/?$/i);
      return {
        reg: regMatch?.[1] ?? null,
        title: card.querySelector(".car-title")?.textContent?.trim() ?? "",
        variant: card.querySelector(".text-muted.fs-6.mb-2")?.textContent?.trim() ?? null,
        location: card.querySelector(".location")?.textContent?.trim() ?? null,
        tags: [...card.querySelectorAll(".tags-content span")].map((s) => s.textContent.trim()),
        price: card.querySelector(".price-cash")?.textContent?.trim() ?? null,
        image: card.querySelector("img")?.getAttribute("src") ?? null,
      };
    }).filter((card) => card.reg));
    return [...new Map(cards.map((card) => [card.reg, card])).values()];
  } finally {
    await page.close();
    await browser.close();
  }
}

const HEDVIG_URL = "https://www.hedvig.com/se/forsakringar/bilforsakring/vad-kostar-bilforsakring";
const MEKONOMEN_URL = "https://www.mekonomen.se/bilverkstad/dackbyte";
const DACKONLINE_URL = "https://www.dackonline.se/search";

const decode = (html = "") => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

const brandAliases = {
  seat: "Seat", skoda: "Skoda", "škoda": "Skoda", volkswagen: "Volkswagen",
  peugeot: "Peugeot", nissan: "Nissan", ford: "Ford", kia: "Kia",
  toyota: "Toyota", volvo: "Volvo", bmw: "BMW", audi: "Audi",
  mercedes: "Mercedes", mazda: "Mazda", renault: "Renault", mini: "Mini",
};

export function offerBrand(title = "") {
  const lower = title.toLocaleLowerCase("sv");
  return Object.entries(brandAliases).find(([key]) => lower.includes(key))?.[1] ?? null;
}

export function parseHedvigMonthly(html, brand) {
  const text = decode(html);
  if (brand) {
    const match = text.match(new RegExp(`${brand}\\s*[|:]?\\s*(\\d{3,4})\\s*kr`, "i"));
    if (match) return Number(match[1]);
  }
  const county = text.match(/Västra Götaland[\s|:]*(\d{3,4})\s*kr[\s|]*(\d{3,4})\s*kr[\s|]*(\d{3,4})\s*kr/i);
  if (county) return Number(county[3]);
  const full = text.match(/Helförsäkring[\s\S]{0,120}?(\d{3,4})\s*kr(?:\/mån)?/i);
  return full ? Number(full[1]) : null;
}

export function parseMekonomenSwap(html) {
  const text = decode(html);
  const match = text.match(/(?:däckbyte\s+)?från\s+(\d{2,5})\s*kr/i);
  return match ? Number(match[1]) : null;
}

export function tyreSearchUrl(dimension) {
  const match = String(dimension ?? "").match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  if (!match) return null;
  const [, width, profile, size] = match;
  return `${DACKONLINE_URL}?width=${width}&profile=${profile}&size=${size}&searchByCar=true`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Bilradarn/1.0 cost benchmark verification" }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${response.status} från ${url}`);
  return response.text();
}

export async function fetchSharedBenchmarks() {
  const [hedvig, mekonomen] = await Promise.allSettled([fetchText(HEDVIG_URL), fetchText(MEKONOMEN_URL)]);
  return {
    checkedAt: new Date().toISOString(),
    hedvig: { url: HEDVIG_URL, html: hedvig.status === "fulfilled" ? hedvig.value : null, error: hedvig.status === "rejected" ? hedvig.reason.message : null },
    mekonomen: { url: MEKONOMEN_URL, html: mekonomen.status === "fulfilled" ? mekonomen.value : null, error: mekonomen.status === "rejected" ? mekonomen.reason.message : null },
  };
}

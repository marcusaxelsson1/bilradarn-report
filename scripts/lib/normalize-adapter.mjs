function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function decodeHtml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function numberFromText(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRegNumber(value) {
  if (!value) return null;
  const normalized = String(value).toUpperCase().replace(/[\s\-–—]/g, "");
  return normalized || null;
}

export function extractDefinitionPairs(html) {
  const pairs = [];
  for (const match of html.matchAll(/<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gs)) {
    const label = decodeHtml(match[1]);
    const value = decodeHtml(match[2]);
    if (label && value) pairs.push({ label, value });
  }
  return pairs;
}

export function findPair(pairs, matcher) {
  return pairs.find(({ label }) => matcher.test(label))?.value ?? null;
}

export function extractJsonLdObjects(html) {
  const objects = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs)) {
    try {
      const value = JSON.parse(match[1]);
      if (value && typeof value === "object") objects.push(value);
    } catch {
      // Ignore unrelated malformed metadata; the caller reports a missing object.
    }
  }
  return objects;
}

export function extractCarJsonLd(html) {
  for (const value of extractJsonLdObjects(html)) {
    const type = value["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => entry === "Car" || entry === "Vehicle")) return value;
  }
  throw new Error("Bilens Car-metadata saknas på detaljsidan");
}

export function extractJsonLdByType(html, wantedType) {
  for (const value of extractJsonLdObjects(html)) {
    const type = value["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((entry) => entry === wantedType)) return value;
  }
  return null;
}

export function extractListItemTexts(html = "") {
  const items = [];
  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = decodeHtml(match[1]);
    if (text) items.push(text);
  }
  return items;
}

export function extractNextData(html) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("__NEXT_DATA__ saknas i HTML-svaret");
  return JSON.parse(match[1]);
}

export function extractMetaContent(html, key) {
  const quoted = escapeRegExp(key);
  const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${quoted}["'][^>]+content=["']([^"']+)["']`, "i");
  const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${quoted}["']`, "i");
  const match = html.match(propertyFirst) || html.match(contentFirst);
  return match ? decodeHtml(match[1]) : null;
}

export function extractOgImage(html) {
  return extractMetaContent(html, "og:image");
}

/**
 * Boundary between live advert data and registry/VIN enrichment providers.
 * Providers are deliberately injected: this module never invents a value when
 * a registry lookup or a personal insurance quote is unavailable.
 */

const STATUSES = new Set(["verified", "partially_verified", "partially-verified", "estimated", "unknown", "observed", "modelled"]);

export function normalizeRegistration(value) {
  return String(value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() || null;
}

export function normalizeVin(value) {
  const vin = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null;
}

export function createEnrichmentRequest(offer) {
  return {
    offerId: offer.id,
    registrationNumber: normalizeRegistration(offer.registrationNumber),
    vin: normalizeVin(offer.vin),
    sourceUrl: offer.sourceUrl ?? null,
    checkedAt: null,
    providers: {
      registry: { required: ["annualTaxSek", "co2Gkm", "firstTrafficDate"] },
      manufacturer: { required: ["serviceInterval", "serviceOperations", "warranty"] },
      insurance: { required: ["machineDamageMaxAge", "machineDamageMaxMileage", "personalQuote"] },
      tyres: { required: ["dimension", "loadIndex", "setPrice", "treadLife"] },
    },
  };
}

function validEvidence(value) {
  if (!value || typeof value !== "object") return false;
  return STATUSES.has(value.status) && (value.sourceUrl == null || /^https?:\/\//.test(value.sourceUrl));
}

export function validateEnrichmentFinding(finding) {
  if (!finding || typeof finding !== "object") throw new Error("Finding måste vara ett objekt");
  if (!finding.offerId) throw new Error("Finding saknar offerId");
  if (!/^https?:\/\//.test(finding.sourceUrl ?? "")) throw new Error("Finding saknar sourceUrl");
  if (!finding.checkedAt || Number.isNaN(Date.parse(finding.checkedAt))) throw new Error("Finding saknar giltig checkedAt");
  for (const [key, value] of Object.entries(finding.costs ?? {})) {
    if (!value || typeof value !== "object" || (value.amountSek != null && !Number.isFinite(value.amountSek))) {
      throw new Error(`Ogiltig kostnad: ${key}`);
    }
    if (!STATUSES.has(value.status ?? "unknown")) throw new Error(`Ogiltig status: ${key}`);
    if (value.sourceUrl != null && !/^https?:\/\//.test(value.sourceUrl)) throw new Error(`Ogiltig källa: ${key}`);
  }
  for (const evidence of Object.values(finding.evidence ?? {})) {
    if (!validEvidence(evidence)) throw new Error("Ogiltig evidenspost");
  }
  return true;
}

export function applyEnrichment(offer, finding) {
  validateEnrichmentFinding(finding);
  if (finding.offerId !== offer.id) return offer;
  const evidence = finding.evidence ?? {};
  const costs = finding.costs ?? {};
  const breakdown = (offer.economics?.breakdown ?? []).map((row) => {
    const update = costs[row.key];
    return update?.amountSek == null ? row : {
      ...row,
      amountSek: Math.round(update.amountSek),
      evidence: {
        ...row.evidence,
        status: update.status ?? row.evidence?.status ?? "unknown",
        sourceUrl: update.sourceUrl ?? row.evidence?.sourceUrl ?? null,
        checkedAt: update.checkedAt ?? finding.checkedAt,
        note: update.note ?? row.evidence?.note ?? null,
      },
    };
  });
  const total36Sek = Math.round(breakdown.reduce((sum, row) => sum + row.amountSek, 0));
  return {
    ...offer,
    economics: offer.economics ? { ...offer.economics, breakdown, total36Sek, monthlyEconomicSek: Math.round(total36Sek / 36) } : offer.economics,
    enrichment: { status: finding.status ?? "partially_verified", checkedAt: finding.checkedAt, findingSource: finding.sourceUrl, evidence },
  };
}

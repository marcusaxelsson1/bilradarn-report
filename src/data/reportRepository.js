import report from "./report.json";
import enrichmentStatus from "./enrichment-status.json";

/** Stable read interface for the generated report snapshot. */
export function getReportSnapshot() {
  return {
    generatedAt: report.generatedAt,
    offers: [...report.leases, ...report.purchases],
    purchases: report.purchases,
    leases: report.leases,
    sources: report.sources,
    excludedPurchases: report.excludedPurchases,
    parameters: report.parameters,
    enrichmentStatus,
  };
}

/** Deep seam for economic calculations. Adapters remain swappable and pure callers need only these two operations. */
export function createEconomicsEngine({ purchase, lease, assumptions = {} }) {
  if (typeof purchase !== "function" || typeof lease !== "function") throw new TypeError("Economics engine requires purchase and lease calculators");
  return Object.freeze({ purchase: (offer) => purchase(offer, assumptions), lease: (offer) => lease(offer, assumptions), assumptions });
}

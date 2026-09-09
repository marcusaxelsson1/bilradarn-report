const COMMON_CORE = [
  "identity.registrationNumber",
  "listing.directUrl",
  "listing.directStatus",
  "vehicle.exactVariant",
  "vehicle.firstTrafficDate",
  "vehicle.odometerMil",
  "vehicle.transmission",
  "vehicle.fuelType",
  "vehicle.familyEquipment",
  "economy.fuelConsumption",
  "economy.vehicleTax",
  "economy.insurance",
  "economy.winterSolution",
];

const PURCHASE_CORE = [
  "purchase.cashPrice",
  "purchase.mandatoryFees",
  "purchase.financeOffer",
  "purchase.warranties",
  "purchase.servicePlan",
  "purchase.repairMatrix",
  "purchase.privateResidualValue",
  "purchase.tradeInValue",
];

const LEASE_CORE = [
  "lease.monthlyFee",
  "lease.initialFee",
  "lease.deposit",
  "lease.mandatoryFees",
  "lease.adjustmentClause",
  "lease.includedMileage",
  "lease.excessMileagePrice",
  "lease.serviceResponsibility",
  "lease.returnTerms",
  "lease.earlyTerminationTerms",
];

const now = () => new Date().toISOString();

export const requiredFields = (kind) => [
  ...COMMON_CORE,
  ...(kind === "purchase" ? PURCHASE_CORE : LEASE_CORE),
];

const MODELLED_ALLOWED = new Set([
  "economy.fuelConsumption",
  "economy.insurance",
  "economy.winterSolution",
  "purchase.servicePlan",
  "purchase.repairMatrix",
  "purchase.privateResidualValue",
  "purchase.tradeInValue",
  "lease.returnTerms",
]);

const emptyEvidence = () => ({
  value: null,
  unit: null,
  status: "missing",
  interval: null,
  sourceUrl: null,
  sourceOwner: null,
  checkedAt: null,
  note: null,
});

export function createOffer(kind = "purchase") {
  const fields = Object.fromEntries(requiredFields(kind).map((key) => [key, emptyEvidence()]));
  fields["listing.directUrl"] = {
    ...emptyEvidence(),
    value: "https://handlare.example/bil/ABC123",
    status: "observed",
    sourceUrl: "https://handlare.example/bil/ABC123",
    sourceOwner: "Exempelhandlaren",
    checkedAt: now(),
  };

  return derive({
    schemaVersion: 1,
    id: "dealer:ABC123",
    kind,
    lifecycle: "discovered",
    fields,
    listingHistory: [{ at: now(), event: "discovered" }],
    priceHistory: [],
    gallery: {
      status: "remote-only",
      sourcePageUrl: fields["listing.directUrl"].value,
      declaredCount: 18,
      localCount: 0,
      capturedAt: null,
      method: null,
      permissionBasis: "unknown",
      contentHashes: [],
    },
  });
}

export function derive(offer) {
  const missing = [];
  const modelled = [];
  const estimated = [];
  for (const key of requiredFields(offer.kind)) {
    const status = offer.fields[key]?.status ?? "missing";
    if (status === "missing" || status === "observed") missing.push(key);
    if (status === "modelled") modelled.push(key);
    if (status === "estimated") estimated.push(key);
  }

  const directlyActive = offer.fields["listing.directStatus"]?.value === "available";
  const invalidModels = modelled.filter((key) => !MODELLED_ALLOWED.has(key));
  const rankable =
    offer.lifecycle === "verified" &&
    missing.length === 0 &&
    estimated.length === 0 &&
    invalidModels.length === 0 &&
    directlyActive;
  return {
    ...offer,
    quality: {
      verifiedCount: requiredFields(offer.kind).length - missing.length - estimated.length,
      totalCoreFields: requiredFields(offer.kind).length,
      missingCoreFields: missing,
      estimatedCoreFields: estimated,
      modelledCoreFields: modelled,
      rankable,
      rankBlockers: rankable
        ? []
        : [
            ...(directlyActive ? [] : ["annonsen är inte direkt verifierad som tillgänglig"]),
            ...(missing.length ? [`${missing.length} kärnfält saknar verifiering`] : []),
            ...(estimated.length ? [`${estimated.length} kärnfält är bara svagt estimerade`] : []),
            ...(invalidModels.length ? [`${invalidModels.length} fält får inte vara modellberäknade`] : []),
            ...(offer.lifecycle === "verified" ? [] : [`livscykelstatus är ${offer.lifecycle}`]),
          ],
    },
  };
}

function updateField(offer, key, patch) {
  return derive({
    ...offer,
    fields: {
      ...offer.fields,
      [key]: { ...(offer.fields[key] ?? emptyEvidence()), ...patch, checkedAt: now() },
    },
  });
}

export function reduceOffer(offer, action) {
  if (action.type === "verify-next") {
    const key = offer.quality.missingCoreFields[0];
    if (!key) return offer;
    let value = `verifierat:${key}`;
    if (key === "listing.directStatus") value = "available";
    if (key === "identity.registrationNumber") value = "ABC123";
    return updateField(offer, key, {
      value,
      status: "verified",
      sourceUrl: key.startsWith("economy.vehicleTax")
        ? "https://fordon-fu-regnr.transportstyrelsen.se/"
        : offer.fields["listing.directUrl"].value,
      sourceOwner: key.startsWith("economy.vehicleTax") ? "Transportstyrelsen" : "Exempelkälla",
    });
  }

  if (action.type === "estimate-next") {
    const key = offer.quality.missingCoreFields.find((field) => field !== "listing.directStatus");
    if (!key) return offer;
    return updateField(offer, key, {
      value: 1000,
      unit: "SEK",
      status: "estimated",
      interval: [800, 1400],
      sourceUrl: "https://evidence.example/method",
      sourceOwner: "Metodunderlag",
      note: "Tydligt intervall tills exakt uppgift kan verifieras",
    });
  }

  if (action.type === "model-next") {
    const key = offer.quality.missingCoreFields.find((field) => MODELLED_ALLOWED.has(field));
    if (!key) return offer;
    return updateField(offer, key, {
      value: 1000,
      unit: "SEK",
      status: "modelled",
      interval: [800, 1400],
      sourceUrl: "https://evidence.example/reproducible-method",
      sourceOwner: "Källbelagd modell",
      note: "Reproducerbar metod med flera observationer och osäkerhetsintervall",
    });
  }

  if (action.type === "promote") {
    const nextLifecycle =
      offer.quality.missingCoreFields.length === 0 && offer.quality.estimatedCoreFields.length === 0
        ? "verified"
        : "preliminary";
    return derive({
      ...offer,
      lifecycle: nextLifecycle,
      listingHistory: [...offer.listingHistory, { at: now(), event: `promoted:${nextLifecycle}` }],
    });
  }

  if (action.type === "price-change") {
    const previous = offer.priceHistory.at(-1)?.amount ?? (offer.kind === "purchase" ? 219900 : 4995);
    const amount = previous - (offer.kind === "purchase" ? 5000 : 200);
    return derive({
      ...offer,
      priceHistory: [...offer.priceHistory, { at: now(), amount, currency: "SEK" }],
    });
  }

  if (action.type === "archive-gallery") {
    return derive({
      ...offer,
      gallery: {
        ...offer.gallery,
        status: "local-complete",
        localCount: offer.gallery.declaredCount,
        capturedAt: now(),
        method: action.method ?? "manual-import",
        permissionBasis: action.permissionBasis ?? "user-supplied-private-copy",
        contentHashes: Array.from({ length: offer.gallery.declaredCount }, (_, i) => `sha256-demo-${i + 1}`),
      },
    });
  }

  if (["reserved", "expired", "available"].includes(action.type)) {
    const lifecycle = action.type === "available" ? "preliminary" : action.type;
    const withStatus = updateField(offer, "listing.directStatus", {
      value: action.type,
      status: "verified",
      sourceUrl: offer.fields["listing.directUrl"].value,
      sourceOwner: "Exempelhandlaren",
    });
    return derive({
      ...withStatus,
      lifecycle,
      listingHistory: [...withStatus.listingHistory, { at: now(), event: action.type }],
    });
  }

  if (action.type === "switch-kind") return createOffer(offer.kind === "purchase" ? "lease" : "purchase");
  return offer;
}

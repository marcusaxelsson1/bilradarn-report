const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function addMonths(date, months) {
  const targetMonth = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

function addMonthsToMonthEnd(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0));
}

function monthOffset(from, to) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS / 30.4375));
}

function futureEvent(type, label, date, asOf, extra = {}) {
  const target = validDate(date);
  if (!target || target <= asOf) return null;
  const month = monthOffset(asOf, target);
  if (month > 60) return null;
  return { type, label, date: target.toISOString().slice(0, 10), month, ...extra };
}

export function buildTimelineEvents(offer, registry, asOfValue, annualMileageMil = 1500) {
  const asOf = validDate(asOfValue) || new Date();
  const firstTraffic = validDate(registry?.firstTrafficDate);
  const events = [];
  let inspectionDue = validDate(registry?.inspection?.validUntil);
  let inspectionIndex = 0;
  while (inspectionDue) {
    const inspection = futureEvent("inspection", inspectionIndex ? "Beräknad besiktning senast" : "Besiktning senast", inspectionDue, asOf, {
      status: inspectionIndex ? "estimated" : "verified",
      sourceUrl: registry?.evidence?.sourceUrl,
      note: inspectionIndex ? "Prognos med 14 månaders intervall om föregående besiktning görs under sin sista tillåtna månad." : "Datum från Transportstyrelsens fordonsuppgift.",
    });
    if (!inspection) break;
    events.push(inspection);
    inspectionDue = addMonthsToMonthEnd(inspectionDue, 14);
    inspectionIndex += 1;
  }

  const warranty = offer.reliability?.warranty;
  if (firstTraffic && Number.isFinite(warranty?.durationMonths)) {
    let expiry = addMonths(firstTraffic, warranty.durationMonths);
    let reason = "tidsgräns";
    if (Number.isFinite(warranty.maxMileageMil) && Number.isFinite(offer.mileageMil) && annualMileageMil > 0) {
      const mileageMonths = Math.ceil(Math.max(0, warranty.maxMileageMil - offer.mileageMil) / (annualMileageMil / 12));
      const mileageExpiry = addMonths(asOf, mileageMonths);
      if (mileageExpiry < expiry) { expiry = mileageExpiry; reason = `${warranty.maxMileageMil.toLocaleString("sv-SE")} mil`; }
    }
    const event = futureEvent("newWarranty", "Nybilsgarantin upphör", expiry, asOf, { status: "verified", sourceUrl: warranty.sourceUrl, note: `Beräknad gräns: ${reason}.` });
    if (event) events.push(event);
  }

  const vehicleDamage = offer.reliability?.vehicleDamageWarranty;
  if (firstTraffic && Number.isFinite(vehicleDamage?.durationMonths)) {
    const event = futureEvent("vehicleDamage", "Vagnskadegarantin upphör", addMonths(firstTraffic, vehicleDamage.durationMonths), asOf, { status: vehicleDamage.status || "partially_verified", sourceUrl: vehicleDamage.sourceUrl });
    if (event) events.push(event);
  }

  const service = offer.maintenance?.service;
  const explicitDue = validDate(service?.nextDue?.value);
  const lastService = validDate(service?.lastServiceDate?.value);
  const intervalMonths = Number(service?.intervalMonths?.value);
  const due = explicitDue || (lastService && Number.isFinite(intervalMonths) ? addMonths(lastService, intervalMonths) : null);
  const serviceEvent = futureEvent("service", "Service senast", due, asOf, { status: explicitDue ? service.nextDue?.status : "estimated", sourceUrl: service?.nextDue?.sourceUrl || service?.lastServiceDate?.sourceUrl, note: explicitDue ? "Datum från serviceunderlaget." : "Beräknat från senaste verifierade service." });
  if (serviceEvent) events.push(serviceEvent);

  return events.sort((a, b) => a.month - b.month || a.label.localeCompare(b.label, "sv"));
}

export function groupTimelineEvents(events) {
  return [...events.reduce((groups, event) => groups.set(event.month, [...(groups.get(event.month) || []), event]), new Map()).entries()].map(([month, items]) => ({ month, items }));
}

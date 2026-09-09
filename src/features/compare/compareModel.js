export function chooseOffers(all, selectedIds) {
  const fallback = [all.find((offer) => offer.kind === "lease")?.id, all.find((offer) => offer.kind === "buy")?.id].filter(Boolean);
  return (selectedIds.length ? selectedIds : fallback).map((id) => all.find((offer) => offer.id === id)).filter(Boolean).slice(0, 5);
}

export function toggleOffer(selectedIds, id) {
  return selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : selectedIds.length < 5 ? [...selectedIds, id] : selectedIds;
}

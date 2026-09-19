import test from "node:test";
import assert from "node:assert/strict";
import { mergeOffers, canonicalKey } from "../scripts/merge-offers.mjs";

function offer(id, fields = {}) {
  return {
    id,
    title: fields.title ?? "Bil",
    registrationNumber: fields.registrationNumber ?? null,
    priceSek: fields.priceSek ?? 200000,
    mileageMil: fields.mileageMil ?? 4500,
    sourceCheckedAt: fields.sourceCheckedAt ?? "2026-09-12T10:00:00Z",
    sourceUrl: fields.sourceUrl ?? `https://example.se/${id}`,
    ...fields,
  };
}

function waykeFeed(offers) {
  return { source: { key: "wayke", name: "Wayke" }, offers, errors: [] };
}

function dealerFeed(key, offers) {
  return { source: { key, name: key }, offers, errors: [] };
}

test("deduplicates the same registration number into a single offer", () => {
  const wayke = waykeFeed([offer("wayke:a", { registrationNumber: "abc123" })]);
  const bilia = dealerFeed("bilia", [offer("bilia:x", { registrationNumber: "ABC-123" })]);
  const { offers } = mergeOffers(wayke, [bilia]);
  assert.equal(offers.length, 1);
  assert.equal(canonicalKey(offers[0]), "reg:ABC123");
});

test("dealer wins over marketplace at conflict", () => {
  const wayke = waykeFeed([offer("wayke:a", { registrationNumber: "abc123", priceSek: 210000 })]);
  const bilia = dealerFeed("bilia", [offer("bilia:x", { registrationNumber: "abc123", priceSek: 205000 })]);
  const { offers } = mergeOffers(wayke, [bilia]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, "bilia:x");
  assert.equal(offers[0].priceSek, 205000);
});

test("between two dealers the most recently checked listing wins", () => {
  const wayke = waykeFeed([]);
  const bilia = dealerFeed("bilia", [offer("bilia:x", { registrationNumber: "abc123", sourceCheckedAt: "2026-09-12T08:00:00Z" })]);
  const riddermark = dealerFeed("riddermark", [offer("riddermark:y", { registrationNumber: "abc123", sourceCheckedAt: "2026-09-12T18:00:00Z" })]);
  const { offers } = mergeOffers(wayke, [bilia, riddermark]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, "riddermark:y");
});

test("offers without a registration number are kept separately", () => {
  const wayke = waykeFeed([
    offer("wayke:a", { registrationNumber: null }),
    offer("wayke:b", { registrationNumber: null }),
  ]);
  const { offers } = mergeOffers(wayke, []);
  assert.equal(offers.length, 2);
});

test("records every observation in the sightings history", () => {
  const wayke = waykeFeed([offer("wayke:a", { registrationNumber: "abc123" })]);
  const bilia = dealerFeed("bilia", [offer("bilia:x", { registrationNumber: "abc123" })]);
  const { sightings } = mergeOffers(wayke, [bilia]);
  const sources = sightings.map((sighting) => sighting.source).sort();
  assert.deepEqual(sources, ["bilia", "wayke"]);
  assert.ok(sightings.every((sighting) => sighting.firstSeenAt && sighting.lastSeenAt && sighting.contentHash));
});

test("detects new, price-changed and removed canonical offers", () => {
  const wayke = waykeFeed([
    offer("wayke:a", { registrationNumber: "aaa111", priceSek: 200000 }),
    offer("wayke:b", { registrationNumber: "bbb222", priceSek: 210000 }),
  ]);
  const previous = [offer("wayke:a", { registrationNumber: "aaa111", priceSek: 195000 }), offer("wayke:gone", { registrationNumber: "ggg333" })];
  const { changes } = mergeOffers(wayke, [], { previousOffers: previous });
  const types = changes.map((change) => `${change.type}:${change.registrationNumber}`);
  assert.ok(types.includes("price:AAA111"), `expected price change, got ${types.join(",")}`);
  assert.ok(types.includes("new:BBB222"), `expected new, got ${types.join(",")}`);
  assert.ok(types.includes("not-in-current-sample:GGG333"), `expected removed, got ${types.join(",")}`);
});

test("passes the wayke feed through unchanged when no dealers are present", () => {
  const wayke = waykeFeed([offer("wayke:a", { registrationNumber: "abc123" }), offer("wayke:b", { registrationNumber: "def456" })]);
  const { offers } = mergeOffers(wayke, []);
  assert.deepEqual(offers.map((item) => item.id), ["wayke:a", "wayke:b"]);
});

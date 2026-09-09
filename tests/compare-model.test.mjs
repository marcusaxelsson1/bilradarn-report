import test from "node:test";
import assert from "node:assert/strict";
import { chooseOffers, toggleOffer } from "../src/features/compare/compareModel.js";

const all = [{ id: "l", kind: "lease" }, { id: "b", kind: "buy" }, { id: "x", kind: "buy" }];
test("comparison selection has deterministic fallback and five-item cap", () => {
  assert.deepEqual(chooseOffers(all, []).map((offer) => offer.id), ["l", "b"]);
  assert.deepEqual(toggleOffer(["l"], "b"), ["l", "b"]);
  assert.deepEqual(toggleOffer(["l"], "l"), []);
  assert.equal(toggleOffer(["1", "2", "3", "4", "5"], "x").length, 5);
});

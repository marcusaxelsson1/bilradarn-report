import test from "node:test";
import assert from "node:assert/strict";
import { createEconomicsEngine } from "../scripts/lib/economics-engine.mjs";

test("economics engine exposes a small swappable interface", () => {
  const engine = createEconomicsEngine({ purchase: (offer) => ({ kind: "buy", offer }), lease: (offer) => ({ kind: "lease", offer }) });
  assert.equal(engine.purchase("a").kind, "buy");
  assert.equal(engine.lease("b").kind, "lease");
  assert.throws(() => createEconomicsEngine({ purchase: null, lease: () => ({}) }), /requires/);
});

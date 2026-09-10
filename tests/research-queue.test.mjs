import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("research queue contains live, auditable enrichment tasks", async () => {
  const queue = JSON.parse(await readFile(resolve(root, "data/research-queue.json"), "utf8"));
  const status = JSON.parse(await readFile(resolve(root, "src/data/enrichment-status.json"), "utf8"));
  assert.equal(queue.schemaVersion, 1);
  assert.equal(queue.horizonMonths, 36);
  assert.equal(queue.annualMileageMil, 1500);
  assert.ok(queue.tasks.length >= 1);
  for (const task of queue.tasks) {
    assert.ok(task.id && task.title);
    assert.match(task.sourceUrl, /^https?:\/\//);
    assert.ok(task.requested.service);
    assert.ok(task.requested.insurance);
    assert.ok(task.requested.tyres);
    assert.ok(task.requested.repairs);
    assert.ok(task.requested.reliability);
    assert.equal(typeof task.missing.reliability, "boolean");
    assert.ok(task.enrichmentRequest?.providers?.registry);
    assert.ok(task.enrichmentRequest?.providers?.insurance);
    assert.match(task.instruction, /primärkällor/i);
  }
  assert.equal(status.pending + status.received, queue.tasks.length);
  assert.ok(queue.tasks.some((task) => task.status === "received" && task.existingFinding?.reliability?.summary));
});

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = ["data:import", "data:lease", "data:report", "data:queue", "data:research", "data:queue", "data:images", "registry:export", "test:data", "test:economics", "test:queue", "test:cost-sources", "build", "test:sites"];

function run(script) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(npm, ["run", script], { cwd: ROOT, stdio: "inherit", env: process.env, shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${script} avslutades med kod ${code}`)));
  });
}

const queuePath = resolve(ROOT, "data/research-queue.json");
async function reportPendingResearch() {
  const queue = JSON.parse(await readFile(queuePath, "utf8"));
  const pending = (queue.tasks ?? []).filter((task) => task.status === "pending");
  if (pending.length) console.warn(`${pending.length} researchuppgifter väntar; de publiceras som okända utan att ersätta befintliga belopp.`);
}

for (const step of steps) {
  await run(step);
  if (step === "data:queue") await reportPendingResearch();
}
console.log("Datapipeline klar: publiceringsbygget är verifierat; eventuella väntande researchuppgifter är tydligt märkta.");

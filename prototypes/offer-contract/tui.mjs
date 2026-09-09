import readline from "node:readline";
import { createOffer, reduceOffer } from "./model.mjs";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";
let state = createOffer("purchase");

function render(clear = true) {
  if (clear) console.clear();
  const latestPrice = state.priceHistory.at(-1)?.amount;
  console.log(`${bold}PROTOTYP — Bilradarns erbjudandekontrakt${reset}`);
  console.log(`${dim}Allt tillstånd är tillfälligt och ligger bara i minnet.${reset}\n`);
  console.log(`${bold}id${reset}:                 ${state.id}`);
  console.log(`${bold}typ${reset}:                ${state.kind}`);
  console.log(`${bold}livscykel${reset}:          ${state.lifecycle}`);
  console.log(`${bold}rankningsbar${reset}:       ${state.quality.rankable ? "JA" : "NEJ"}`);
  console.log(`${bold}kärnfält${reset}:           ${state.quality.verifiedCount}/${state.quality.totalCoreFields} verifierade`);
  console.log(`${bold}estimerade fält${reset}:    ${state.quality.estimatedCoreFields.length}`);
  console.log(`${bold}modellfält${reset}:        ${state.quality.modelledCoreFields.length}`);
  console.log(`${bold}senaste pris${reset}:       ${latestPrice ? `${latestPrice.toLocaleString("sv-SE")} kr` : "saknas"}`);
  console.log(`${bold}prisobservationer${reset}:  ${state.priceHistory.length}`);
  console.log(`${bold}galleri${reset}:            ${state.gallery.status} (${state.gallery.localCount}/${state.gallery.declaredCount} lokala)`);
  console.log(`${bold}gallerimetod${reset}:       ${state.gallery.method ?? "—"}`);
  console.log(`${bold}historikhändelser${reset}:  ${state.listingHistory.length}`);
  console.log(`\n${bold}Blockerar ranking${reset}`);
  console.log(state.quality.rankBlockers.length ? state.quality.rankBlockers.map((x) => `- ${x}`).join("\n") : "- inget");
  console.log(`\n${bold}Nästa saknade kärnfält${reset}`);
  console.log(state.quality.missingCoreFields.slice(0, 5).map((x) => `- ${x}`).join("\n") || "- inget");
  console.log(`\n${bold}Kommandon${reset}`);
  console.log("[v] verifiera nästa  [m] modellera nästa [e] estimera nästa  [g] pröva befordran");
  console.log("[p] prissänkning     [i] importera galleri [r] reserverad    [x] utgången");
  console.log("[a] åter tillgänglig [t] byt köp/leasing   [q] avsluta");
}

function dispatch(key) {
  const actions = {
    v: { type: "verify-next" },
    m: { type: "model-next" },
    e: { type: "estimate-next" },
    g: { type: "promote" },
    p: { type: "price-change" },
    i: { type: "archive-gallery", method: "manual-import" },
    r: { type: "reserved" },
    x: { type: "expired" },
    a: { type: "available" },
    t: { type: "switch-kind" },
  };
  if (actions[key]) state = reduceOffer(state, actions[key]);
}

if (process.argv.includes("--demo")) {
  render(false);
  for (const key of ["v", "m", "e", "p", "i", "g", "x"]) {
    dispatch(key);
    console.log(`\n${dim}Efter kommando: ${key}${reset}`);
    render(false);
  }
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt() {
  render();
  rl.question("> ", (answer) => {
    const key = answer.trim().toLowerCase()[0];
    if (key === "q") return rl.close();
    dispatch(key);
    prompt();
  });
}
prompt();

# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Validated design direction

- Use the selected scenario-first Bilradarn layout: shortlist rail on the left and a spacious 36-month comparison workspace on the right.
- Keep leasing and purchase visually separate while comparing them in one cost bridge.
- Show total cost, comparable monthly cost, monthly cash flow, base/stress scenarios, and verified/calculated/estimated provenance.
- Use a restrained light Scandinavian visual system with ink blue, teal for verified data, and amber for estimates.
- Avoid dashboard-card overload and automotive advertising aesthetics.
- Show purchase price, remaining loan balance, private-sale residual value, and conservative trade-in value explicitly; depreciation alone is insufficient.
- Rank leasing offers and purchase offers independently. Side-by-side comparison is optional and may pair different models.
- Each offer needs a detail view with the seller's image gallery, captured listing facts, conditions, sources, and verification gaps.
- Treat the offer detail as a complete dealer listing plus a substantially deeper financial plan: show all captured factory options and equipment, seller copy, registration/model facts and conditions alongside the analysis.
- Charts must always have a visible legend, labelled currency y-axis, understandable event labels, and hover/tap details that explain every cost or value represented by a data point.
- The detail view must expose the actual month-by-month payment plan as well as economic three-year cost; teach the distinction between cash paid, cost consumed, retained car value and remaining debt in plain Swedish for a non-expert.
- Price breakdowns must reconcile visibly from advertised price and acquisition extras through finance, running costs and retained value to total and monthly comparison cost.

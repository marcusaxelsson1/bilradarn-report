# Design QA — Bilradarns beslutsupplevelse

- Source visual truth: `C:\Users\Marcus\Documents\ChatGPT\Bil Research\bilradarn-report\public\assets\reference-selected.png`
- Implementation screenshots: `decision-overview.png`, `decision-comparison-final.png`, `decision-detail-v2.png`, `decision-mobile-v2.png`
- Full-view comparison: `decision-design-comparison.png`
- Focused comparison: `decision-design-focus.png`
- Desktop test viewport: 1488 × 1058 CSS px
- Mobile test viewport: 390 × 844 CSS px
- Source raster: 1487 × 1058 px
- Comparison implementation raster: 1217 × 1380 px
- Density normalization: source and implementation were placed in equal-width comparison columns; layout proportions and hierarchy were compared at normalized width because the in-app screenshot exporter scaled the implementation raster.
- State: topplistor in base scenario; comparison in stress scenario; purchase detail in economy, risk and sources states.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: DM Sans, weights and navy hierarchy remain faithful to the selected Scandinavian direction. The denser offer metadata stays legible at desktop and mobile breakpoints.
- Spacing and layout rhythm: the source's calm rail/workspace split, fine dividers and compact financial hierarchy are preserved. The comparison is intentionally taller because the approved value/debt forecast is a second chart rather than being compressed into the original 36-month screen.
- Colors and visual tokens: ink blue, blue comparison state, teal verification/value and amber estimates/events remain consistent with the source.
- Image quality and asset fidelity: existing generated raster vehicle assets are used without placeholder boxes, custom SVGs or CSS illustrations. The detail gallery explicitly identifies local count versus source count.
- Copy and content: purchase and lease are separated; totals and monthly averages are explicit; no hypothetical month-36 sale appears; private residual, trade-in and debt are separately named; after lease month 36 is described as returned rather than free. The detail view now preserves dealer-style description, twelve vehicle facts and 28 categorized equipment items.
- Interaction: ranking selection, arbitrary comparison pair, base/stress toggle, search filtering, filter disclosure, detail navigation, five detail tabs, local file-picker entry point, expandable monthly payments and hover/tap chart details work.
- Responsiveness: the 390 px layout has no global horizontal overflow; ranking cards stack and comparison/detail sections become single-column.
- Accessibility: semantic headings and buttons, labelled search and file input, visible focus styles, non-color status copy and readable contrast are present.

## Intentional differences from the visual source

- The source is a single comparison screen. The decision prototype adds a ranking-first entry screen, persistent navigation, searchable archive and a full offer detail screen because these are required by the product brief.
- The value/debt/equity view continues through month 96 with widening uncertainty, while the source only depicted the 36-month comparison.
- The prototype switcher is temporary evaluation chrome and will not ship in the final report.

## Comparison history

### Iteration 1

- P1: stress totals and cost-row totals did not reconcile.
- P1: the value forecast stated widening uncertainty but rendered only one line.
- P2: a negative difference was described as “dyrare med leasing”.

Fixes made:

- Scaled every stress cost row to the selected offer's stress total so the bridge reconciles.
- Added a visibly widening value interval through month 96.
- Made difference sign and cheaper/dyrare wording conditional.

Post-fix evidence:

- `decision-comparison-final.png` shows corrected stress totals, uncertainty band and wording.
- `decision-design-comparison.png` and `decision-design-focus.png` compare the corrected prototype with the selected design direction.

### Iteration 2 — offer detail and economic legibility

- P1: value and cashflow charts lacked a monetary Y-axis and the detail chart lacked an always-visible legend.
- P1: the offer detail omitted much of the source advertisement's facts and equipment.
- P1: the economic total was not reconciled visibly to an itemized breakdown or an actual monthly payment plan.
- P2: vertical event lines had no readable event labels.

Fixes made:

- Added a formatted SEK Y-axis, X-axis month labels, named legends, uncertainty-band legend and pointer/touch tooltips with every amount in the selected month.
- Added dealer description, twelve vehicle facts, family checks and a 28-item categorized equipment list.
- Added a cost bridge that sums exactly to 202 550 kr for the purchase example and 198 180 kr for the leasing example, with evidence level per row.
- Added start plus all 36 monthly payment rows, each expandable into loan/leasing, fuel, insurance, tax, service, tyres and reserves.
- Added named event chips synchronized with the chart lines.

Post-fix evidence:

- `decision-detail-v2.png` shows the educational cost split, interactive payment chart, visible SEK axis and reconciled breakdown; `decision-mobile-v2.png` confirms the revised detail hierarchy at 390 px.
- Browser checks confirmed the 37-row plan, value/debt/band legend, tooltip activation and required equipment fields.

## Primary interactions tested

- Search “Toyota” reduced the visible result cards from six to two and clearing restored the list.
- Filter button revealed the active search criteria.
- Opening the selected comparison pair showed the correct two independently ranked candidates.
- Stress toggle changed the displayed totals and the leasing/köp difference.
- Detail page opened for the chosen purchase candidate.
- Economy, Bil & familj, Risk & skydd and Källor & luckor tabs all rendered their intended state.
- A clean browser tab loaded the prototype with no console errors or warnings.

## Follow-up polish

- P3: replace repeated prototype vehicle renders with each real advertisement's local image archive once live data is connected.

### Iteration 3 — flerbilsjämförelse

Visual target: `C:\Users\Marcus\AppData\Local\Temp\codex-clipboard-fc808ce0-0a93-41e3-badc-cca19adbcca2.png`

Implementation evidence:

- `design-qa-multicar/01-multicar-desktop.png` — three-car default at desktop width.
- `design-qa-multicar/02-five-cars.png` — five selected cars with horizontal scrolling and frozen cost labels.
- `design-qa-multicar/03-mobile-two-car-focus.png` — mobile reference/focus selection.
- `design-qa-multicar/04-final-desktop.png` — final post-polish desktop state.

Findings and fixes:

- P1: the previous comparison was restricted to one lease and one purchase. Replaced with a working two-to-five-car selector supporting addition, removal and reordering.
- P1: charts dominated the decision. The itemized cost matrix is now the primary surface; charts are an expandable secondary view.
- P1: the former cost bridge was too coarse. Rows now follow the approved detailed cost model and group acquisition, retained value, running cost and risk.
- P2: data quality was not visible for every compared amount. Each populated cell now carries its evidence level and opens a plain-language method explanation.
- P2: wide comparisons risked unreadable mobile columns. Mobile defaults to one reference car against a selected focus car, with controlled horizontal scrolling.

Primary interactions verified:

- Added two cars to reach the five-car maximum.
- Reordered the Kia column to the first position.
- Switched to stress scenario and confirmed totals and stress evidence changed.
- Opened an amount cell and confirmed its evidence explanation.
- Expanded the charts and confirmed both cashflow and value/debt views rendered.
- Production build completed successfully.

No actionable P0, P1 or P2 issues remain. Five-car desktop comparison intentionally scrolls horizontally while the first column stays frozen.

### Iteration 4 — bilspecifika grafer och restvärde

Implementation evidence: `design-qa-multicar/05-per-car-graphs.png`.

Findings and fixes:

- P1: the expanded cashflow chart still rendered one generic purchase line and one generic lease line. It now renders one consistently colored line per selected car and lets the user hide or show individual cars from the legend.
- P1: the demonstration value curve did not intersect the table's stated M36 residual. Every purchase curve is now piecewise anchored to its own purchase price, exact M36 residual and a separate lower M96 forecast.
- P2: full-height event lines could not identify which of several cars an event belonged to. A single vertical line remains for the shared M36 comparison boundary; service, warranty, insurance, inspection, loan and lease events use one aligned event lane per car.
- P2: the value view mixed a generic value and debt pair. Each purchase car now has a solid value line, dashed debt line, widening uncertainty band and explicit M36/M96 value card.

Primary interactions verified:

- All three default cars appeared as independent cashflow lines.
- Both selected purchase cars appeared with independent value and debt series.
- The Kia curve and value card show M36 118 000 kr and M96 64 900 kr; the Toyota example shows M36 126 000 kr and M96 73 080 kr.
- Clicking the cashflow plot opened a month tooltip containing separate itemized payments for every visible car.
- Legend controls and per-car event lanes rendered with consistent vehicle colors.
- Production build completed successfully.

No actionable P0, P1 or P2 issues remain in the corrected graph state.

final result: passed

### Iteration 7 — informationsflik och datatransparens

Implementation evidence:

- `design-qa-multicar/11-information-tab-top.png` — desktopvyn från sidhuvud till källmatris.
- `design-qa-multicar/10-information-tab.png` — metodmärkning, ekonomiska vyer och nästa byggsteg.
- `design-qa-multicar/12-information-tab-mobile.png` — mobilvy med fyrdelad ikonmeny och enkelkolumnflöde.

Findings and fixes:

- P1: det saknades en beständig förklaring av hur annonser blir verifierade kalkyler. En ny navigerbar informationsflik beskriver sex steg från upptäckt till notifiering.
- P1: prototypens demonstrationsdata kunde misstolkas som aktiv livebevakning. Informationsfliken visar en tydlig nulägesvarning och statusraden byter där till `Prototypdata · livekoppling ej aktiv`.
- P2: källor och beräkningsstatus var utspridda. En sammanhållen matris beskriver källa och metod för pris, skatt, bränsle, lån, försäkring, service, reparationer, restvärde och vinterhjul.
- P2: skillnaden mellan ekonomisk treårskostnad, faktiskt kassaflöde samt värde/skuld/eget kapital behövde förklaras. De tre vyerna har nu var sin lättläst definition.

Primary interactions verified:

- `Så fungerar det` öppnas från både sidomenyn och prototypväxlaren och visar aktivt läge.
- En ren lokal laddning och navigation gav inga konsolvarningar eller körfel.
- Mobilkontrollen hade fyra jämnbreda navigationsknappar och ingen horisontell sidöverflow.
- Produktionsbuilden och Sites-paketeringstesterna slutfördes utan fel.

No actionable P0, P1 or P2 issues remain in the information view.

final result: passed

### Iteration 6 — startbetalningar i grafen

Implementation evidence: `design-qa-multicar/08-start-cost-markers.png`.

- Startbetalningen visas nu som en stor färgkodad markör vid grafens början utan att påverka M1–M60-skalan.
- Markörerna är 36 × 36 px stora cirklar och visar endast avrundade belopp som `26k`, `58k` och `59k`; ordet `Start` är borttaget för att undvika breda etiketter.
- Hover eller fokus visar exakt belopp samt kontantinsats/förhöjd avgift, handlaravgift, uppläggning och vinterhjul.
- Produktionsbuilden slutfördes utan fel och webbläsaren verifierade tre synliga startmarkörer med korrekt exakt detaljbelopp.

final result: passed

### Iteration 5 — skrollbar kostnadspanel, M60 och linjemarkörer

Implementation evidence: `design-qa-multicar/07-m60-markers.png`.

Findings and fixes:

- P1: hoverpanelen bytte månad när pekaren flyttades mot innehållet och kunde därför inte skrollas. Klick låser nu månaden; panelen tar emot pekarhändelser, har egen vertikal skroll och en tydlig stängknapp.
- P1: kassaflödet slutade vid lånets månad 36. Köpbilar fortsätter nu till M60 med bränsle, försäkring, skatt, service, däck och förhöjd modellbaserad reparationsreserv. Leasinglinjen slutar vid M36.
- P2: separata händelserader tog stor plats och låg visuellt långt från bilkurvorna. Service, skydd, slutbetalt lån, kontroll och avtalslut visas nu som små typkodade symboler direkt på respektive linje.
- P2: servicekostnaden var inte läsbar i grafen. Markörens hover/fokus visar bil, månad, servicenamn, kostnad och förklarande notering.
- P2: startbetalningen pressade ihop normala månader. Standardläget använder en linjär M1–M60-skala med startbetalningarna i separata kort; användaren kan växla till `Inklusive start`.

Primary interactions verified:

- Klick på kassaflödet skapade `.multi-tooltip.pinned` med `pointer-events: auto`, `overflow-y: auto`, `clientHeight: 308` och `scrollHeight: 422`.
- Ett verkligt mushjulstest inne i panelen flyttade `scrollTop` från 0 till 114 medan panelen förblev låst på samma månad.
- Kia Ceed-markören vid M48 visade `Storservice`, `6 500 kr` och prognosförklaringen.
- Kassaflödesaxeln visar M1, M12, M24, M36, M48 och M60; leasinglinjen avslutas vid M36 medan köp fortsätter.
- Produktionsbuilden slutfördes utan fel.

No actionable P0, P1 or P2 issues remain in this interaction state.

final result: passed

### Iteration 8 — första riktiga annonskällan

Implementation evidence: `design-qa-multicar/13-live-source-feed.png`.

- Waykes publika handlarlager är anslutet som upptäckts- och detaljkälla.
- Den verifierade körningen läste 120 sökträffar, hämtade 18 detaljsidor och gav noll detaljfel.
- En andra körning gav noll falska förändringar.
- Sex riktiga annonser visas i informationsfliken med verkliga bilder, pris, år, miltal, handlare, avstånd, registrering, observerad skatt och källänk.
- Kia Ceed Sportswagon hos Din Bil i Göteborg visas först eftersom annonsen uttryckligen innehåller ISOFIX, stabilitetskontroll, parkeringssensorer och backkamera.
- Liveannonserna är uttryckligen märkta som förhandsgranskning och hålls utanför ekonomisk ranking tills hela kostnadsberikningen är verifierad.
- En ren webbläsarladdning av både topplista och informationsflik gav inga konsolvarningar eller körfel och ingen horisontell overflow.

No actionable P0, P1 or P2 issues remain in the live-source view.

final result: passed

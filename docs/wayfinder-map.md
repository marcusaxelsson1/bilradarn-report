# Wayfinder: Daglig kostnadsberikning

## Destination

En specificerad och testbar design för en daglig agent som hämtar kostnadsuppgifter för Bilradarns bilar, validerar dem mot Transportstyrelsen, sanerar privat information och publicerar godkända ändringar till GitHub Pages.

## Notes

Domänkontext: `CONTEXT.md`. Agenten ska publicera direkt efter validering. Personlig försäkringsprofil används endast som privat indata.

## Decisions so far

- Mekonomen används som generellt riktpris för service och standardreparationer.
- Fast verkstadsriktmärke är Mekonomen Bilverkstad Göteborg, Deltavägen 4. Mekonomen publicerar ingen storleksranking, så detta är en reproducerbar standardpunkt – inte ett påstående om fysisk störst kapacitet.
- Märkesverkstad används som jämförelse eller för modell-/garantispecifika arbeten.
- Transportstyrelsen har företräde för fordonsfakta och skatteuppgifter.
- Agenten hämtar inte eller ändrar Transportstyrelseuppgifter, annonsdata eller bränslepriser. Dessa uppdateras i separata flöden eller manuellt.
- Däck hämtas endast från Däckonline.
- Billigaste giltiga försäkringsalternativ används i ekonomiplanen; flera alternativ visas separat när de kan hämtas.
- Registreringsnummer identifierar bilen, men en personlig försäkringspremie kräver ofta även ägar- och profiluppgifter; annars används riktpris/saknad uppgift.
- Lånekostnad är ett fast planeringsantagande: 36 månader, rak amortering och 6,1 % nominell rörlig ränta. Agenten ändrar inte dessa inställningar.

## Open decision tickets

- [Källor och åtkomst](wayfinder/01-kallor-och-atkomst.md) — vilka webbplatser/API:er agenten får använda och hur åtkomst hanteras.
- [Matchning och variant](wayfinder/02-matchning-och-variant.md) — när ett fynd anses gälla exakt rätt bil.
- [Kostnadsmodell och period](wayfinder/03-kostnadsmodell-och-period.md) — hur priser, intervall och 36-månadersbelopp normaliseras.
- [Validering och publicering](wayfinder/04-validering-och-publicering.md) — vilka regler som stoppar eller släpper igenom ett fynd.

## Not yet specified

- Hur personliga försäkringsuppgifter skickas till respektive källa utan att hamna i loggar eller publika filer.
- Hur källor som saknar maskinläsbara priser ska hanteras.

## Out of scope

- Automatisk beställning av försäkring, service eller andra avtal.

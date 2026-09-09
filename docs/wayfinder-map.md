# Wayfinder: Daglig kostnadsberikning

## Destination

En specificerad och testbar design för en daglig agent som hämtar kostnadsuppgifter för Bilradarns bilar, validerar dem mot Transportstyrelsen, sanerar privat information och publicerar godkända ändringar till GitHub Pages.

## Notes

Domänkontext: `CONTEXT.md`. Agenten ska publicera direkt efter validering. Personlig försäkringsprofil används endast som privat indata.

## Decisions so far

- Mekonomen används som generellt riktpris för service och standardreparationer.
- Märkesverkstad används som jämförelse eller för modell-/garantispecifika arbeten.
- Transportstyrelsen har företräde för fordonsfakta och skatteuppgifter.
- Agenten hämtar inte Transportstyrelseuppgifter, annonsdata eller bränslepriser i första versionen.
- Däck hämtas endast från Däckonline.
- Billigaste giltiga försäkringsalternativ används i ekonomiplanen; flera alternativ visas separat när de kan hämtas.

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

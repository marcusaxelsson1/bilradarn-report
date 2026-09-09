# Fordonsberikning via registreringsnummer/VIN

## Flöde

1. Annonsimporten sparar registreringsnummer, VIN och käll-URL när uppgifterna finns.
2. `data/research-queue.json` skapar ett `enrichmentRequest` med separata krav för register, tillverkare, försäkring och däck.
3. En provider hämtar uppgifter från en auktoriserad eller primär källa. Provider ska returnera ett fynd med `offerId`, `sourceUrl`, `checkedAt`, `costs` och evidensposter.
4. `vehicle-enrichment-adapter.mjs` normaliserar identiteter och validerar fyndet innan det kan påverka rapporten.
5. Uppgifter utan tillräckligt underlag sparas som `unknown` eller `estimated`; de får aldrig ersättas med ett påhittat exakt belopp.

## Providergräns

Adaptern kräver ingen specifik leverantör. En framtida registerprovider kan använda ett godkänt API eller en manuell export från Transportstyrelsen. API-nycklar ska ligga i miljövariabler och inte i rapporten eller versionshanteringen. Försäkringspremier är personliga och ska därför fortsätta vara `unknown` tills en offert för rätt förare och omfattning finns.

## Kvalitetskrav

- Varje verifierat värde har URL och kontrolltid.
- Registreringsnummer normaliseras till versaler utan mellanslag.
- VIN accepteras bara om det är ett giltigt 17-teckens VIN.
- Modelluppgifter får användas som underlag, men märks `partially_verified` när variant eller exemplar inte kan styrkas.
- En provider får inte skriva direkt till `report.json`; fyndet går via köbyggaren.

## Nuvarande begränsning

Adaptern och kontraktet är på plats, men ingen extern registertjänst är inkopplad ännu. Fram till dess används annonsens uppgifter eller tydligt märkta estimat.

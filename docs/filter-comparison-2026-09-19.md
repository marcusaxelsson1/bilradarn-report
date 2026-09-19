# Filterjämförelse 2026-09-19

## Resultat

Det gemensamma köpbilsfiltret gav 193 källobservationer och 188 unika annonser efter deduplicering. Den tidigare källuppsättningen gav 134 observationer och 133 unika annonser. Täckningen ökade därmed med 55 unika annonser, cirka 41 procent, samtidigt som inga kända elbilar eller laddhybrider passerade filtret.

| Källa | Före | Efter | Förändring | Upptäckta efter | Detaljsidor efter | Träff per detaljsida |
|---|---:|---:|---:|---:|---:|---:|
| Bilia | 11 | 22 | +11 | 1 780 | 1 780 | 1,2 % |
| Din Bil | 23 | 31 | +8 | 492 | 0 | listdata används |
| Hedin | 13 | 26 | +13 | 1 493 | 1 493 | 1,7 % |
| Kamux | 16 | 29 | +13 | 992 | 484 | 6,0 % |
| Niemi | 3 | 6 | +3 | 697 | 9 | 66,7 % |
| Riddermark | 47 | 49 | +2 | 3 900 | 49 | 100 % |
| Wayke | 21 | 30 | +9 | 192 | 39 | 76,9 % |

Före-värdena är senast sparade källresultat från 12–19 september. Efter-värdena kommer från sammanhängande livekörningar den 19 september. Lager kan ha förändrats under perioden, så skillnaden är en operativ jämförelse och inte ett kontrollerat marknadsexperiment.

## Ny filtermodell

- Hårda avslag: pris över 250 000 kr, årsmodell utanför 2020–2024, mer än 10 000 mil, elbil, laddhybrid, opraktisk karosstyp, fel modell-/storleksfamilj eller otillgänglig annons.
- Normalspår: 2021–2023, högst 7 500 mil och automat.
- Undantagsspår: 2020/2024, 7 501–10 000 mil, manuell eller mer än 150 km från Göteborg. Dessa ligger kvar i katalogen men får inte skarp ranking innan undantagsregeln är verifierad.
- Saknade eller tvetydiga fält blir verifieringspunkter i stället för tysta antaganden.
- Det tidigare prisgolvet 120 000 kr är borttaget eftersom kravställningen bara anger ett anskaffningstak.

## Effektivitet per källa

Riddermark och Niemi har full strukturerad listdata och filtreras nu innan detaljhämtning. Riddermark minskade därför från ungefär 3 900 möjliga detaljanrop till 49 och Niemi från 697 till 9.

Din Bil kan avgöras helt från listkorten och behöver inga detaljanrop för grundfiltret. Wayke filtrerar i källsökningen och lokalt. Kamux kan förfiltreras på modell-URL men kräver detaljsidan för tillförlitliga fordonsfält.

Bilia och Hedin är kvarvarande svaga punkter. Deras publika sitemaps saknar pris, årsmodell, miltal och drivlina, medan fullständig filtrerbar listdata inte är tillgänglig via en tillåten stabil feed. Därför måste 1 780 respektive 1 493 familjemodell-URL:er fortfarande detaljläsas. Nästa stora effektivitetsvinst kräver en dokumenterad feed eller tillåten listmekanism från dessa två källor.

## Kvalitetskontroll

- 188 unika annonser efter deduplicering; fem dubbletter slogs ihop.
- 66 standardkandidater och 122 undantagskandidater.
- 46 annonser har minst ett fält som fortfarande måste verifieras.
- Noll kända elbilar, laddhybrider eller redan underkända kandidater finns bland de inkluderade annonserna.
- Samtliga sju källkörningar avslutades med noll adapterfel.

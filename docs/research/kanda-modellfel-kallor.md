# Research: kända modellfel, driftsäkerhet och reparationskostnad

Uppdaterad: 2026-09-10

## Slutsats

Det finns ingen enskild datakälla som samtidigt kan säga hur ofta en bilmodell går sönder, exakt vad som går sönder och vad reparationen kostar i Sverige. En trovärdig funktion måste i stället kombinera flera typer av bevis och tydligt skilja mellan:

1. **Maskinskada** – ett plötsligt fel på exempelvis motor, växellåda, elektronik eller klimatsystem.
2. **Driftstopp** – fel som gjort att bilen behövt vägassistans.
3. **Besiktningsfel** – tekniska brister som upptäcks vid kontrollbesiktning.
4. **Återkallelse eller servicekampanj** – ett av tillverkare eller myndighet bekräftat konstruktions- eller säkerhetsfel.
5. **Ägarrapporterat problem** – självrapporterad erfarenhet utan säkerställd nämnare.

För Bilradarn rekommenderas följande kärna:

- Länsförsäkringars maskinskadestatistik för svensk skadebild och kostnadsnivå.
- ADAC:s haveristatistik för modell- och årsmodellsvis risk för driftstopp.
- EU Safety Gate, KBA och tillverkarens egen kontroll för återkallelser.
- NHTSA:s öppna data om återkallelser, klagomål och tekniska servicebulletiner som kompletterande problemdetektering, med tydlig USA-varning.
- DVSA:s öppna brittiska besiktningsdata som komplettering, efter att normalt slitage filtrerats bort.
- Svenska verkstadsofferter för aktuella reparationspriser; försäkringsrapportens genomsnitt används bara som reservvärde.

Vi bör inte presentera en enda ogenomskinlig “tillförlitlighetspoäng”. Bättre är separata mått för driftstoppsrisk, dokumenterade maskinfel, möjlig kostnad och datans säkerhet.

## Ja – det finns färdiga hållbarhets- och reparationsindex

Det är sannolikt någon av följande typer av artiklar eller index man brukar ha sett:

| Index | Vad det bygger på | Det man får ut | Relevans för Bilradarn |
|---|---|---|---|
| [ADAC Pannenstatistik](https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/) | Tysk vägassistans, modell och första registreringsår | Driftstopp per 1 000 bilar, ibland typiska haveriorsaker | **Mycket hög**, särskilt för europeiska 2021–2023-modeller |
| [Warrantywise Reliability Index](https://www.warrantywise.co.uk/reliability-index-2025/) | Över 180 000 brittiska reparationsanspråk; frekvens, ålder, miltal och arbetstid | Modellpoäng, vanliga fel och genomsnittlig reparationskostnad | **Hög som komplettering**, men brittiska priser och proprietär data |
| [MotorEasy Reliability Index](https://www.motoreasy.com/car-reliability) | Brittiska garanti-/reparationsanspråk | Modellpoäng, felfördelning och genomsnittskostnad | **Hög som kontrollkälla**, men metod och rådata är inte helt öppna |
| [What Car? Reliability Survey](https://www.whatcar.com/news/most-reliable-cars/n27337) | Cirka 32 500 ägare; fel, reparationskostnad och tid ur trafik | Modellbetyg och felområden för bilar upp till fem år | **Hög som triangulering**, bra åldersmatchning men enkät och publicistiskt innehåll |
| [TÜV-Report](https://www.tuev-verband.de/presse/publikationen/reporte/tuev-report-autobild) | Cirka 9,5 miljoner tyska kontrollbesiktningar | Modell- och åldersvis andel betydande tekniska fel | **Medel**, eftersom besiktningsfel inte är samma sak som maskinhaveri |
| [Consumer Reports Reliability](https://www.consumerreports.org/cars/car-reliability-owner-satisfaction/consumer-reports-car-reliability-faq-a1099917197/) | Cirka 380 000 amerikanska medlemsfordon, 20 felområden | Modellårsvis tillförlitlighet och förväntad tillförlitlighet | **Medel**, stark metod men amerikanska varianter och betalvägg |
| [J.D. Power Vehicle Dependability Study](https://www.jdpower.com/business/press-releases/2025-us-vehicle-dependability-study-vds) | 34 175 amerikanska originalägare av tre år gamla bilar i 2025 års studie | Problem per 100 fordon över 184 problemområden | **Låg–medel**, bra åldersfönster men USA-specifikation och små/stora problem blandas |
| [RepairPal Reliability Rating](https://repairpal.com/reliability) | Amerikanska verkstadsdata om kostnad, frekvens och allvar | Modell-/märkespoäng och årlig reparationskostnad | **Låg–medel**, användbart för felupptäckt men fel marknad och valuta |
| [Honest John MOT Results](https://classics.honestjohn.co.uk/mot-results/mot-articles/the-mot-files-mot-data-faqs/) | Brittiska MOT-resultat | Godkännandegrad och vanliga besiktningsfel | **Medel som rå signal**; sajten varnar själv för att det inte är total tillförlitlighet |

Warrantywise är närmast den funktion som efterfrågas: deras 2025-index använder reparationsanspråk för tre till tio år gamla bilar och kräver minst 250 försäkrade bilar för en modell. Det väger samman hur ofta reparation begärs, bilens ålder och miltal samt arbetstid, och visar både vanliga fel och kostnad. Nackdelen är att underliggande brittisk rådata inte är fritt tillgänglig och att ett kommersiellt garantiurval kan vara snedvridet.

Det finns alltså gott om färdiga index att **läsa och länka till**. Problemet är inte brist på innehåll, utan att indexen inte är direkt jämförbara och sällan får kopieras som en egen publik databas. Artiklar med rubriker som “mest och minst pålitliga bilar” är ofta redaktionella presentationer av just ADAC-, TÜV-, Warrantywise-, What Car?-, Consumer Reports- eller J.D. Power-underlag.

## Rekommenderad källhierarki

### 1. Svenska försäkringsskador: bäst för maskinfel och skadebelopp

[Länsförsäkringars Maskinskaderapport 2020](https://www.lansforsakringar.se/49aedf/globalassets/aa-global/dokument/ovrigt/aa-om-oss/rapporter-och-undersokningar/lf_maskinskaderapport_2020.pdf) är den mest relevanta svenska öppna källan som hittades. Underlaget består av omkring 10 000 ersatta skador under 2018 på två till åtta år gamla fordon eller fordon som gått högst 12 000 mil. Rapporten redovisar frekvens, komponentgrupp, genomsnittlig körsträcka vid skada och reparationskostnad inklusive moms.

Rapportens centrala nivåer är 1,7 maskinskador per 100 personbilar och år, cirka 18 000 kr per skada och cirka 7 900 mil vid skadetillfället. Den redovisar bland annat motor 25 000 kr, växellåda/drivning 24 600 kr, elektronik 11 900 kr, kyl/värme 9 600 kr och bränslesystem 13 100 kr i dåtidens genomsnittspriser. Komplett motorbyte kostade i genomsnitt 75 000 kr.

Styrkor:

- Svenskt fordonsbestånd och svenska verkstadskostnader.
- Faktiska ersatta fel, inte enbart enkätsvar.
- Normal slitagedel som kopplingslamell är uttryckligen undantagen i taxonomin.
- Kan identifiera motorfamiljer som sticker ut, exempelvis vissa 1,2- och 1,6-litersmotorer.

Begränsningar:

- Skadorna är från 2018 och matchar därför inte direkt dagens årsmodeller 2021–2023.
- Flera tabeller är på märkesnivå, inte generation, motor och växellåda.
- Garantier och goodwill gör att vissa fel aldrig når försäkringsbolaget. Rapporten påpekar själv denna bias.
- Skador under självrisken saknas och verkstädernas försäkringsavtal kan ge lägre priser än privatkundspris.

Användning: baslinje för komponenternas skadeallvar och svensk kostnadsstorlek, men aldrig ensam grund för att påstå att en aktuell modell har ett vanligt fel.

### 2. ADAC Pannenstatistik: bäst öppen källa för modellvis driftstopp

[ADAC Pannenstatistik 2026](https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/) bygger på vägassistanshändelser och visar antal driftstopp per 1 000 registrerade fordon för modellserie och första registreringsår. 2026 års rapport omfattar 158 modellserier från 27 märken. En modellserie måste ha stora registreringsvolymer; redovisade årsmodeller har minst 5 000 registrerade fordon.

Styrkor:

- Stor nämnare och jämförbar modell-/årsmodellstatistik.
- Bra på frågan “hur ofta blir bilen stående?”.
- ADAC:s modellmaterial beskriver även typiska störningar och haveriorsaker.

Begränsningar:

- Tysk fordonspark, utrustning, klimat och motorutbud kan skilja sig från Sverige.
- Mäter bara fel som leder till vägassistans, inte alla dyra eller återkommande verkstadsfel.
- 12-voltsbatteriet står för många stopp och måste särredovisas om vanligt slitage ska filtreras bort.
- Innehållet är publicistiskt material; automatisk hämtning och återpublicering behöver villkors- och licenskontroll.

Användning: visa en separat, tydligt benämnd driftstoppsnivå för exakt modellgeneration och registreringsår när matchningen är säker.

### 3. Återkallelser: hög säkerhet om felet, låg information om frekvens

Följande källor är relevanta:

- [EU Safety Gate](https://ec.europa.eu/safety-gate/#/screen/home) innehåller europeiska varningar och återkallelser för bland annat motorfordon. Portalen kan exportera sökresultat till Excel. EU anger att data får återanvändas om källa, hämtdatum och språkversion anges; se [Safety Gate 2025-rapportens portalbeskrivning](https://op.europa.eu/webpub/just/safety-gate-2025-report/en/).
- [KBA:s återkallelsedatabas](https://www.kba-online.de/) är en officiell tysk modell-/variantdatabas och är ofta mer precis för europeiska bilar än amerikanska källor.
- Respektive tillverkares svenska VIN-kontroll är den slutliga källan för om just ett exemplar omfattas och om åtgärden är utförd.
- [NHTSA Datasets and APIs](https://www.nhtsa.gov/nhtsa-datasets-and-apis) erbjuder öppna API:er och bulkfiler för återkallelser, ägarklagomål, utredningar och “manufacturer communications”/tekniska servicebulletiner. Data uppdateras löpande.

En återkallelse bevisar att ett definierat fel har funnits i en viss produktionsmängd. Den visar däremot inte att felet inträffar ofta på alla exemplar. En aktiv, tillämplig återkallelse ska visas separat, och åtgärdskostnaden för ägaren anges som 0 kr först när tillverkaren bekräftar kostnadsfri åtgärd.

NHTSA är mycket värdefullt för att hitta fel och servicebulletiner, men amerikanska motorer, växellådor, programvaror och modellnamn kan skilja sig. Därför får ett amerikanskt fynd högst bli en kandidat tills samma generation och drivlina verifierats för Europa.

### 4. Besiktningsdata: mycket data, men svarar på en annan fråga

[DVSA:s anonymiserade MOT-data](https://www.data.gov.uk/dataset/c63fca52-ae4c-4b75-bab5-8b4735e1a4c9/anonymised-mot-tests-and-results) innehåller alla brittiska MOT-resultat sedan 2005, inklusive märke, modell, mätarställning och felorsak. Data för 2023 och 2024 kan laddas ner som ZIP och är publicerad under UK Open Government Licence. Detta är den bästa öppna maskinläsbara massdatakällan som hittades.

Den lämpar sig för att beräkna fel per 1 000 tester inom modell, ålder och körsträcka. Innan Bilradarn använder den måste däck, bromsbelägg/skivor, lampor, torkarblad och andra ägar-/slitagerelaterade anmärkningar filtreras bort. Även efter filtrering är det besiktningsrisk, inte haveririsk.

[Bilprovningens svenska besiktningsstatistik](https://www.bilprovningen.se/hallbarhet/besiktningsstatistik) är relevant som svensk baslinje men den nuvarande öppna publiceringen är huvudsakligen aggregerad. Äldre rapporter hade modellrelaterade fel, men är för gamla för nuvarande bilurval.

[TÜV-Report 2026](https://www.tuev-verband.de/presse/publikationen/reporte/tuev-report-autobild) bygger på cirka 9,5 miljoner tyska huvudbesiktningar och 246 modeller i sex åldersklasser. Detaljrapporten säljs som en publikation, så den är bättre som redaktionell kontrollkälla än som automatiskt återpublicerad databas.

DEKRA:s tidigare modellrapport bör inte användas som aktuell huvudkälla. [DEKRA förklarar](https://www.dekra.de/de/dekra-gebrauchtwagenreport/) att man slutade publicera rapporten eftersom förreparationer inför besiktning gjorde det svårt att skilja fordonskvalitet från verkstadskvalitet. Detta är en viktig varning även för all annan besiktningsstatistik.

### 5. Ägarundersökningar och garantidata: bra triangulering, oftast licensierat innehåll

- [What Car? Reliability Survey](https://www.whatcar.com/news/most-reliable-cars/n27337) samlade 2025 omkring 32 500 brittiska ägarsvar. Ägarna rapporterar fel under de senaste 24 månaderna, kostnad och tid ur trafik. Resultaten kan vara modell- och drivlineindelade men är redaktionellt/proprietärt innehåll.
- [Consumer Reports metodbeskrivning](https://www.consumerreports.org/cars/car-reliability-owner-satisfaction/consumer-reports-car-reliability-faq-a1099917197/) beskriver cirka 380 000 fordon i 2025 års amerikanska undersökning och 20 felområden. Urvalet består av medlemmar och resultaten kan bygga på angränsande årsmodeller när stickprovet är litet.
- [MotorEasy Reliability Index](https://www.motoreasy.com/car-reliability) använder brittiska garantianspråk och redovisar reparationsfrekvens, genomsnittskostnad och vanliga fel. Underliggande data och modellmatchning är dock inte öppet publicerad på samma sätt som DVSA-data.
- [Vi Bilägares begagnattester](https://www.vibilagare.se/test/begbil) kombinerar modellhistorik, långtest, besiktningsresultat, återkallelser och ägarerfarenheter i svensk kontext. Det är värdefull redaktionell triangulering men ofta premiuminnehåll och inte en fri datakälla.

Sådana källor får stödja och nyansera ett påstående, men deras betyg bör inte kopieras eller göras till en automatiserad databas utan avtal.

### 6. Forum, Reddit, Facebookgrupper och verkstadsbloggar: endast upptäckt

Forum är bra för att hitta sökord, symptom, motorbeteckningar och möjliga fel. De saknar normalt nämnare, innehåller dubbletter och lockar oproportionerligt många missnöjda ägare. Ett forumfynd får därför aldrig ensamt märkas “vanligt fel”. Det ska starta en kontroll mot återkallelse, servicebulletin, försäkringsdata, stor enkät eller minst två oberoende fackkällor.

## Reparationskostnader i Sverige

Kostnaden måste kopplas till en definierad reparation, bilvariant, datum, ort och om priset inkluderar moms. Rekommenderad ordning:

1. **Aktuell svensk verkstadsoffert för registreringsnumret.** [Mekonomens bokning](https://www.mekonomen.se/boka-tid/valj-servicereparation) kan ge pris direkt efter registreringsnummer, mätarställning och verkstadsval; annars skickas en offertförfrågan.
2. **Jämförelseoffert.** [Autobutler](https://www.autobutler.se/sidor/hur-fungerar-det) förmedlar flera verkstadsofferter, men dess fair-use-regler gör systematisk låtsasoffertinhämtning olämplig. Den bör användas för verkliga köpfall, inte daglig masshämtning.
3. **Försäkringsbaserat reservvärde.** Länsförsäkringars komponentgenomsnitt kan inflationsjusteras och märkas “historiskt skadegenomsnitt”, men är inte en offert.
4. **Delar plus arbetstid.** OEM-/kvalitetsdelpris kombinerat med licensierad arbetstidsdata (exempelvis tillverkarinformation, Autodata eller HaynesPro) och lokal timtaxa. Utan exakt motorkod och arbetsmoment blir summan för osäker.

Konsumentverket anger att ett ungefärligt pris normalt inte får överskridas med mer än 15 procent och att konsumenten har rätt till specificerad faktura; se [Konsumenttjänstlagen](https://www.konsumentverket.se/lagar/konsumenttjanstlagen/) och [verkstadspris](https://www.konsumentverket.se/varor-och-tjanster-process/verkstaden-kraver-for-mycket-betalt/). Det motiverar att Bilradarn visar skillnad mellan bindande offert, ungefärlig prisuppgift och modellberäknat spann.

Beloppen i Länsförsäkringars rapport är från 2018 och ska inte visas som dagens nominella pris utan indexering och tydlig datering. Ett intervall är mer ärligt än en falskt exakt siffra, exempelvis “ungefär 18 000–28 000 kr, svensk verkstadskontroll saknas”.

## Definition: vad ska räknas som kända fel?

### Inkludera

- Motorintern skada, turbo/kompressor, kamdrivning med onormalt tidigt fel.
- Växellåda, växlingsrobot, dubbelkopplingsmekanik och fyrhjulsdrift, men inte normal lamellförslitning.
- Bränslesystem, spridare, bränslepump och avgasrening när det är tekniskt fel.
- Styrdon, generator, startmotor, infotainment-/kommunikationsfel och säkerhetssystem.
- AC-kompressor, kondensor eller vattenpump vid onormalt fel.
- Batteri, inverter, laddare och elmotor på elbil/laddhybrid.
- Konstruktionsrelaterad korrosion, vatteninträngning och karossfel.

### Exkludera normalt

- Däck, hjulinställning, torkarblad, glödlampor och förbrukningsvätskor.
- Bromsbelägg och bromsskivor vid normal livslängd.
- Schemalagd service, filter, olja, tändstift och planerat kamremsbyte.
- Kopplingslamell och andra friktionsdelar vid normal förslitning.
- Skador från olycka, felaktig användning, försummad service eller eftermarknadsmodifiering.

Ett normalt slitagefel kan ändå inkluderas om en högkvalitativ källa visar **onormalt tidigt eller konstruktionsrelaterat** fel. Då ska just det påståendet och intervallet i mil/ålder beläggas.

## Matchning: modellnamnet räcker inte

Varje påstående måste i möjligaste mån matchas mot:

- generation/plattform,
- tillverkningsintervall och modellår,
- motorfamilj och motorkod,
- växellådstyp och växellådskod,
- drivmedel, hybridvariant och drivning,
- marknad/land,
- vid återkallelse: typgodkännande, produktionsdatum eller VIN-intervall.

“Volkswagen Golf 2021” är för grovt. Ett fel på en dieselmotor eller DQ200-låda får inte visas på en Golf med annan motor eller växellåda. Transportstyrelsens redan sparade tekniska data blir därför nyckeln till korrekt källmatchning, även om denna framtida agent inte själv ska hämta registeruppgifterna.

## Evidensnivåer för Bilradarn

| Nivå | Krav | Tillåten formulering |
|---|---|---|
| A – bekräftad | Officiell återkallelse/servicekampanj eller svensk skadefrekvens som direkt matchar variant | “Bekräftat fel/återkallelse för denna variant” |
| B – stark | Stor skade-, garanti- eller driftstoppsdatabas med samma generation och drivlina | “Överrepresenterat/vanligt i underlaget” |
| C – samstämmig | Minst två oberoende fackkällor eller en stor ägarundersökning, men ingen säker frekvens | “Återkommande rapporterat problem” |
| D – signal | Forum, enstaka verkstadsartikel eller USA-data med osäker EU-matchning | Endast intern granskningskö; inte som “känt fel” |

Ett fel bör inte visas som “vanligt” utan en nämnare eller tydlig överrepresentation i en stor datakälla. Om bara förekomst är bekräftad ska sidan säga “rapporterat” eller “omfattas av återkallelse”, inte ge sken av frekvens.

## Förslag till framtida informationskort

För varje modell/variant bör kortet innehålla:

- Felområde och vardaglig beskrivning.
- Berörda generationer, motorer, växellådor och årsmodeller.
- Symptom att vara uppmärksam på.
- När felet typiskt uppträder i år/mil, om belagt.
- Frekvens eller relativ risk med nämnare – annars “frekvens okänd”.
- Konsekvens: körbar, verkstadsbesök eller risk för driftstopp.
- Reparationsspann i SEK inklusive moms, prisdatum och metod.
- Garanti, goodwill, servicekampanj eller återkallelse.
- Evidensnivå, källor och senast kontrollerad.

Ett separat sammanfattningsfält kan exempelvis visa:

> **Driftsäkerhet:** bättre än genomsnittet i ADAC för årsmodellen.  
> **Dokumenterade modellfel:** två starkt belagda, ett återkommande rapporterat.  
> **Dyraste relevanta risk:** växellådsfel, uppskattat 25 000–40 000 kr.  
> **Datatäckning:** medel – tysk och brittisk statistik, begränsat svenskt modellunderlag.

Detta är mer pedagogiskt och granskningsbart än ett enda betyg som blandar driftstopp, små elektronikproblem, slitage och reparationskostnad.

## Möjlig framtida insamlingsprocess

1. Läs bilens redan sanerade Transportstyrelsefält och annonsdata.
2. Normalisera generation, motorfamilj, växellåda och marknad.
3. Hämta öppna strukturerade källor: NHTSA och DVSA; exportera relevanta Safety Gate-resultat.
4. Matcha ADAC och redaktionella källor manuellt eller genom en licensierad integration.
5. Låt språkmodellen föreslå felkandidater, men aldrig själv fastställa frekvens eller variantmatchning.
6. Kräv källregel och evidensnivå innan publicering.
7. Hämta eller beräkna svenskt reparationsspann separat.
8. Publicera bara sanerade sammanfattningar med länkar, hämtdatum och metod.
9. Lägg osäkra eller motstridiga uppgifter i en manuell granskningskö.

Agenten bör alltså vara en orkestrator ovanpå deterministisk matchning, källregler och validering – inte bara en prompt som googlar och skriver en fri sammanfattning.

## Särskilda risker

- **Marknadsmismatch:** samma modellnamn kan ha annan motor eller växellåda i USA, Storbritannien, Tyskland och Sverige.
- **Årsmodell kontra registreringsår:** källorna använder olika begrepp.
- **Survivorship bias:** äldre problemexemplar kan redan vara skrotade eller reparerade.
- **Garantibias:** långa garantier flyttar fel från försäkringsstatistiken.
- **Besiktningsbias:** verkstadsförberedelse och ägarunderhåll påverkar resultatet.
- **Rapporteringsbias:** forum och frivilliga enkäter överrepresenterar vissa ägare.
- **Inflation och offertskillnad:** äldre skadebelopp kan inte visas som aktuella svenska kundpriser.
- **Copyright och villkor:** redaktionella tester och kommersiella index får normalt sammanfattas och länkas, inte masskopieras.
- **Falsk precision:** frånvaro av data betyder “okänt”, inte “felfri”.

## Rekommenderat beslut före byggstart

Gör en pilot på fem bilar med olika drivlinor från det befintliga urvalet. För varje bil tas högst fem icke-slitagefel fram och granskas manuellt. Piloten ska mäta:

- hur många källor som faktiskt går att matcha till rätt motor/växellåda,
- hur ofta källorna motsäger varandra,
- hur många fel som har en riktig frekvens/nämnare,
- hur många reparationskostnader som kan prissättas i Sverige,
- hur lång tid en kvalitetssäkrad bil tar.

Först efter piloten bör vi bestämma om funktionen kan publiceras automatiskt eller om varje ny modell behöver manuell attest. Min preliminära rekommendation är automatisk insamling och uppdatering, men manuell attest för nya felpåståenden. Officiella återkallelser med säker variantmatchning kan uppdateras automatiskt.

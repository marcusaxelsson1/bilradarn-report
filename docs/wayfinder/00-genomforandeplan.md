# Genomförandeplan: daglig kostnadsagent

## Mål

En schemalagd agent som berikar befintliga bilannonser med källbelagda riktpriser, utan att ändra Transportstyrelse-, annons- eller bränsledata, och som publicerar sanerade resultat till GitHub Pages.

## Etapper och klart-kriterier

### 1. Körmiljö och åtkomst

- Välj körmiljö för schemaläggning (GitHub Actions eller lokal värd).
- Lägg käll- och eventuella API-hemligheter i secrets, aldrig i repo eller loggar.
- Klart när en torrkörning kan starta utan personuppgifter i utdata.

### 2. Källadaptrar

- Däck: Däckonline.
- Verkstad: Mekonomen Bilverkstad Göteborg, Deltavägen 4 som fast riktpunkt.
- Försäkring: Hedvigs offentliga statistik som fast riktvärde; inga individuella offerter.
- Klart när varje adapter returnerar belopp/intervall, källa, kontrolltid och status.

### 3. Matchning och normalisering

- Matcha Wayke-id, registreringsnummer, modell, årsmodell, drivlina, växellåda, karosstyp och variant.
- Normalisera engångs-, månads- och årskostnader till 36 månader.
- Behåll intervall och `unknown`; omvandla aldrig saknade belopp till noll.
- Klart när negativa testfall stoppar fel variant och okända belopp lämnar tidigare värden orörda.

### 4. Validering och säker publicering

- Transportstyrelsens importerade data är konfliktspärr.
- Publicera endast icke-personliga fynd med källa, kontrolltid och osäkerhetsstatus.
- Logga nya, ändrade, borttagna och blockerade fynd.
- Klart när en validerad körning producerar en granskningsbar diff och ingen rådata/PII kan stageas.

### 5. Schemalagd pipeline

- Kör annonsimport två gånger dagligen enligt befintligt flöde.
- Kör kostnadsagenten en gång dagligen efter aktuell annonsdata finns tillgänglig.
- Kör tester, bygg och publicera bara vid godkänd validering.
- Klart när en lyckad körning automatiskt pushar och en misslyckad körning inte publicerar delresultat.

### 6. Pilot och drift

- Pilotkör på 3–5 bilar med olika märken och både kända/okända fynd.
- Kontrollera Pages manuellt: bilder, registerdata, ekonomiplan och källstatus.
- Lägg till retry/backoff, timeout, rate-limit och körningssammanfattning.
- Klart när pilotens resultat godkänts och agenten kan köras utan manuell redigering.

## Beroenden

1. Körmiljö och åtkomst måste vara bestämda före schemaläggning.
2. Källadaptrar måste finnas före pilot.
3. Matchning/validering måste passera tester före automatisk push.
4. Försäkringsflödet är frivilligt; offentligt riktvärde är fallback.

## Utanför agenten

Transportstyrelseimport, annonsimport, bränslepris och appens fasta låneantagande (36 månader, 6,1 %) sköts av befintliga flöden eller inställningar.

# Transportstyrelsen – manuellt godkänt köflöde

Bilradarn använder en lokal Playwright-brygga för att koppla den integrerade kön till Transportstyrelsens e-tjänst utan att försöka kringgå säkerhetskontroller.

## Starta hjälparen

Öppna PowerShell i projektmappen och kör projektets lokala utvecklingsstart:

```powershell
npm.cmd run dev
```

Det startar både Bilradarn och bryggan automatiskt. Bryggan använder en installerad Edge om den finns. Om Edge ligger på en annan plats kan `BILRADARN_BROWSER_PATH` anges före kommandot.

## Arbetsflöde

1. Öppna Bilradarns **Verifiera fordonsuppgifter**.
2. Klicka **Öppna och fyll registreringsnummer**. Hjälparen öppnar Transportstyrelsen och fyller numret.
3. Klicka själv på **Sök fordonsuppgifter** och lös eventuell säkerhetskontroll.
4. Gå tillbaka till Bilradarn och klicka **Hämta resultat och gå vidare**.

Bryggan sparar både den synliga texten och hela HTML-sidan lokalt i registerresultatet. Kända fält (till exempel årsmodell, skatt, CO₂ och tidigare ägare) plockas ut när etiketten är entydig; övriga uppgifter finns kvar i råtext/HTML för senare parserstöd. Resultatet matchas mot aktuell registrering innan kön går vidare.

Varje körning arkiverar dessutom alla fångade snapshots (före/efter “Visa alla uppgifter” och eventuella iframe-dokument) i `data/registry-results/raw/<REGISTRERING>.json`. Det råarkivet är facit för fortsatt parserutveckling och kan granskas utan att köra om sökningen.

Om hjälparen inte är startad öppnas Transportstyrelsen som reserv och JSON-import kan användas.

## Question

Vilka fordonsfält måste matcha innan ett pris får kopplas till en bil: registreringsnummer, VIN, modell, årsmodell, motor, variant, miltal och ort?

## Resolution

Registreringsnummer räcker för att identifiera bilen hos många försäkringsbolag, men inte för att få en personlig premie. Prisflöden kräver ofta även ägarens personnummer och profiluppgifter, och ibland BankID eller andra steg. Agenten får därför använda registreringsnummer för fordonsmatchning men får inte kalla ett pris exakt/personligt om försäkringsbolaget kräver uppgifter som agenten inte kan lämna på ett tillåtet sätt.

Försäkringsprofilen är 38 år, Göteborg, 1 500 mil/år och helförsäkring. När personlig offert inte kan hämtas ska resultatet sparas som riktpris eller saknad uppgift, inte som verifierad premie.

För kostnadsfynd krävs dessutom att annonsens Wayke-id och registreringsnummer hör till samma annons, samt att märke/modell, årsmodell, drivmedel, växellåda, karosstyp och variant stämmer. Miltal får ändras över tid men ska ligga inom den observerade skillnaden och alltid tidsstämplas. Om variant eller drivlina är oklar blir fyndet `partially_verified` eller `unknown` och får inte ersätta ett befintligt verifierat värde.

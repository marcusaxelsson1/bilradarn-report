## Question

Vilka automatiska kontroller ska krävas innan ett fynd publiceras direkt, och hur ska ändringar och konflikter med Transportstyrelsen rapporteras?

## Resolution

Ett fynd får publiceras först när det har en giltig källa, kontrolltid, offer-id och matchningsstatus. Belopp måste vara numeriska och ha rätt valuta/enhet. `verified` kräver exakt variantmatchning; `estimated`, `modelled` och `partially_verified` visas som riktvärden med tydlig osäkerhetsmärkning; `unknown` lämnar befintligt värde orört.

Transportstyrelsens redan importerade uppgifter är spärr mot konflikt: agenten får aldrig skriva över skatt, besiktning, ägarantal eller tekniska fordonsfält. Vid konflikt, saknad identitet eller försämrad källa skapas en granskningspost och det tidigare publicerade värdet behålls. Prisändringar och borttagna annonser loggas i körningssammanfattningen. Efter godkänd validering publiceras endast sanerade, icke-personliga filer till GitHub Pages.

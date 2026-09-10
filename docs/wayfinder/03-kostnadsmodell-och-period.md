## Question

Hur ska agenten omvandla engångspriser, månadspriser, intervall och villkor till jämförbara 36-månaderskostnader utan att dölja osäkerhet?

## Resolution

Alla jämförelser normaliseras till 36 månader. Engångskostnader tas en gång, månadspriser multipliceras med 36 och årliga priser med tre. Intervall behåller både låg/hög nivå och visas som intervall i källunderlaget; agenten får inte ersätta ett intervall med en falsk exakt siffra. Kostnader utan belopp sparas som `unknown` och påverkar inte summan förrän ett belopp har validerats.

Det fasta låneriktmärket är 6,1 % nominell rörlig ränta, rak amortering och 36 månader. Frivilliga vinterhjul som eventuellt saknas i annonsen visas separat och ingår inte i ekonomisk kostnad eller månadsplan. Däckbyte/slitage, försäkring och service redovisas som egna poster med källa och osäkerhetsstatus.

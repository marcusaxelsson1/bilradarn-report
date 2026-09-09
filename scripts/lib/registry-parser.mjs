const clean = (value) => value.replace(/\s+/g, " ").trim();

export function extractRegistryFields(rawText) {
  const lines = rawText.split(/\r?\n/).map(clean).filter(Boolean);
  const labelPattern = /^(?:\(\d+\*\))?(Registreringsnummer|Fabrikat|Handelsbeteckning|Fordonsstatus|Färg|Fordonsår|Fordonet tillverkat|Fordonsslag|Fordonslag|Fordons[slags]*klass|Fordonskategori|Besiktas senast|Senast godkända besiktning|Senaste besiktning|Mätarställning|Användningsförbud|Påställt första gången i Sverige|Registreringsdatum|Import\/införsel|Fordonsskattepliktigt|Fordonsskatt|Årsskatt|Vägtrafikregisteravgift|Betalningsmånad\/er|Debitering vid påställning \(inkl\. avgifter\)|Trängselskattepliktigt|Giltig till|Koldioxidutsläpp|CO₂|CO2|Antal tidigare ägare|Tidigare ägare|Antal brukare|Förvärvsdatum|Försäkringsbolag|Försäkringsdatum|Besiktningsresultat|Besiktningsdatum|Identifieringsnummer|Typgodkännandenummer|Typgodkännandedatum|Typ|Variant|Version|Skyltformat, fram|Skyltformat, bak|Senaste utfärdade registreringsbevis del [12]|Kaross|Längd|Bredd|Höjd|Tjänstevikt \(faktisk vikt\)|Tjänstevikt|Max lastvikt|Totalvikt|Ursprunglig totalvikt|Skattevikt|Antal axlar|Max axelavstånd axel 1-2|Spårvidd|Däckdimension|Fälgdimension|Största belastning koppling fordon|Max släpvagnsvikt|Max släpvikt, obromsad|Max sammanlagd bruttovikt \(tågvikt\)|Släpets högsta tillåtna totalvikt vid körkortsbehörighet B|Släpets högsta tillåtna totalvikt vid utökad körkortsbehörighet B|Antal passagerare, max|Drivmedel|Växellåda|Effekt, max \(för elmotor\)|Motoreffekt|Slagvolym|Euroklassning|Miljöklass|Utsläppsklass|Elfordon|Effektnorm|Max hastighet|Ljudnivå stillastående|Varvtal stillastående|Ljudnivå vid körning|Avgasdirektiv\/reglemente|Landsvägskörning|Stadskörning|Blandad körning|Låg|Medium|Hög|Extra hög|Kolmonoxid, CO|Totala kolväten, THC|Ickemetankolväten, NMHC|Kväveoxider, NOx|Antal partiklar|Bränsleförbrukning)$/i;
  const fields = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const label = lines[i].replace(/^\(\d+\*\)/, "");
    const value = lines[i + 1];
    if (!labelPattern.test(lines[i]) || !value || label.length < 3) continue;
    if (!fields.some((field) => field.label === label)) fields.push({ label, value });
    i += 1;
  }
  return fields;
}

export function knownRegistryValues(rawText) {
  const numberAfter = (patterns) => { for (const pattern of patterns) { const match = rawText.match(pattern); if (match) return Number(match[1].replace(/\s/g, "")); } return null; };
  const textAfter = (patterns) => { for (const pattern of patterns) { const match = rawText.match(pattern); if (match) return match[1].trim(); } return null; };
  const ownerField = extractRegistryFields(rawText).find((field) => /tidigare.*ägare/i.test(field.label));
  const userField = extractRegistryFields(rawText).find((field) => /antal brukare/i.test(field.label));
  const previousOwners = ownerField && /^\s*\d+\s*$/.test(ownerField.value) ? Number(ownerField.value) : null;
  const ownerCount = userField && /^\s*\d+\s*$/.test(userField.value) ? Number(userField.value) : null;
  return {
    firstTrafficDate: textAfter([/första (?:gången )?i trafik[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i, /fordonet tillverkat[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i]),
    modelYear: numberAfter([/årsmodell[^\d]*(20\d{2})/i, /fordonsår[^\d]*(20\d{2})/i]),
    co2Gkm: numberAfter([/CO[₂2][^\d]*(\d{2,3})\s*g\/?km/i, /koldioxid[^\d]*(\d{2,3})/i]),
    annualTaxSek: numberAfter([/år(?:lig)?\s*fordonsskatt[^\d]*(\d[\d\s]*)\s*(?:kr|kronor)/i, /årsskatt[^\d]*(\d[\d\s]*)\s*(?:kr|kronor)/i, /fordonsskatt[^\d]*(\d[\d\s]*)\s*(?:kr|kronor)/i]),
    previousOwners,
    ownerCount,
    inspection: { lastDate: textAfter([/senaste besiktning[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i]), validUntil: textAfter([/besiktas senast[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i]), status: "observed" },
  };
}

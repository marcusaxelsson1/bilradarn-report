import { ArrowSquareOut, Camera, CheckCircle, Database, MapPin, WarningCircle } from "@phosphor-icons/react";
import liveFeed from "./data/live-offers.json";

const money = (value) => `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`;
const missingLabel = { antisladd: "antisladd", isofix: "ISOFIX", parking: "parkeringssensorer", camera: "backkamera/360°" };

function checkedTime(value) {
  if (!value) return "Inte körd";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function LiveOffer({ offer }) {
  const complete = offer.quality.passesRequiredEquipment;
  return <article className={`live-offer ${complete ? "requirements-ok" : "requirements-missing"}`}>
    <a className="live-image" href={offer.sourceUrl} target="_blank" rel="noreferrer">
      {offer.imageUrls[0] ? <img src={offer.imageUrls[0]} alt={`${offer.title} hos ${offer.dealer}`}/> : <Camera/>}
      <span><Camera/>{offer.imageUrls.length} bildlänkar</span>
    </a>
    <div className="live-offer-body">
      <div className="live-offer-status">
        <span className="source-live"><i/>Riktig annons · kontrollerad</span>
        <span className={complete ? "pass" : "gap"}>{complete ? <CheckCircle weight="fill"/> : <WarningCircle weight="fill"/>}{complete ? "Alla fyra krav syns" : "Annonslucka"}</span>
      </div>
      <h3>{offer.title}</h3>
      <p>{offer.variant}</p>
      <div className="live-price"><strong>{money(offer.priceSek)}</strong><span>{offer.modelYear} · {new Intl.NumberFormat("sv-SE").format(offer.mileageMil)} mil · {offer.transmission}</span></div>
      <div className="live-location"><MapPin weight="fill"/><span>{offer.dealer} · {offer.place} · {offer.distanceKm} km</span></div>
      <dl>
        <div><dt>Registrering</dt><dd>{offer.registrationNumber || "Saknas"}</dd></div>
        <div><dt>Skatt i annons</dt><dd>{offer.annualTaxSek != null ? `${money(offer.annualTaxSek)}/år` : "Saknas"}</dd></div>
        <div><dt>Drivmedel</dt><dd>{offer.fuelType}</dd></div>
        <div><dt>Kaross enligt källa</dt><dd>{offer.bodyType || "Saknas"}</dd></div>
      </dl>
      {!complete && <p className="live-gap-copy">Saknar uttryckligt annonsbevis för {offer.missingRequirements.map((item) => missingLabel[item] || item).join(", ")}. Bilen är inte borttagen, men kan inte kvalificeras ännu.</p>}
      <a className="live-source-link" href={offer.sourceUrl} target="_blank" rel="noreferrer">Öppna den kontrollerade annonsen <ArrowSquareOut/></a>
    </div>
  </article>;
}

export function LiveDataPanel() {
  const sorted = [...liveFeed.offers].sort((a, b) => Number(b.quality.passesRequiredEquipment) - Number(a.quality.passesRequiredEquipment) || a.priceSek - b.priceSek);
  const qualifying = liveFeed.offers.filter((offer) => offer.quality.passesRequiredEquipment).length;
  return <section className="report-section live-data-section">
    <div className="live-data-heading">
      <div><span className="eyebrow">Liveimport</span><h2>Riktiga handlarannonser är anslutna</h2><p>Wayke används för upptäckt och annonsdetaljer. Ingen bil ekonomirankas förrän kostnadskällorna är kompletta.</p></div>
      <div className="live-run-status"><Database weight="duotone"/><span><b>Senast hämtad {checkedTime(liveFeed.generatedAt)}</b><small>{liveFeed.source.documentsRead} sökträffar lästa · {liveFeed.offers.length} detaljsidor · {liveFeed.errors.length} fel</small></span></div>
    </div>
    <div className="live-metrics">
      <div><b>{liveFeed.source.reportedHits}</b><span>annonser matchade sökfiltret</span></div>
      <div><b>{liveFeed.offers.length}</b><span>familjemodeller detaljkontrollerade</span></div>
      <div><b>{qualifying}</b><span>har annonsbevis för alla säkerhetskrav</span></div>
      <div><b>{liveFeed.changes.length}</b><span>förändringar sedan föregående körning</span></div>
    </div>
    <div className="live-disclaimer"><WarningCircle weight="fill"/><span><b>Förhandsgranskning, inte topplista.</b> Pris, bilfakta, utrustning och bildlänkar kommer från riktiga annonser. Skatt är ännu bara observerad i annonsen; försäkring, finansiering, service, reparationer, vinterhjul och restvärde återstår.</span></div>
    <div className="live-offer-grid">{sorted.slice(0,6).map((offer) => <LiveOffer key={offer.id} offer={offer}/>)}</div>
    <div className="live-source-foot"><span>Källa: <a href={liveFeed.source.searchUrl} target="_blank" rel="noreferrer">Waykes publika handlarlager <ArrowSquareOut/></a></span><span>{liveFeed.source.detailPagesRead} originaldetaljer lästa vid samma körning</span></div>
  </section>;
}

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowSquareOut, Bell, Camera, Car, ChartLine, CheckCircle, FileText, MagnifyingGlass, MapPin, Scales, WarningCircle } from "@phosphor-icons/react";
import report from "./data/report.json";
import enrichmentStatus from "./data/enrichment-status.json";
import { getReportSnapshot } from "./data/reportRepository";
import { money, shortMoney, stamp, palette } from "./ui/formatters";
import { Evidence } from "./ui/Evidence";
import { cashflowSeries, valueDebtSeries } from "./features/charts/chartViewModel";
import { Info } from "./features/info/Info";
import { Ranking } from "./features/ranking/Ranking";
import { chooseOffers, toggleOffer } from "./features/compare/compareModel";
import { applyScenario, readScenario } from "./features/economics/scenario";

const labels = { verified: "Verifierad", observed: "Annonsuppgift", modelled: "Modellberäknad", estimated: "Estimerad", incomplete: "Ofullständig", missing: "Saknas" };

const REGISTRY_URL = "https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/";
function saveRegistryLocally(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return value; }
  catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    const compact = { ...value, html: undefined };
    for (const storageKey of Object.keys(localStorage)) {
      if (!storageKey.startsWith("bilradarn.registry.")) continue;
      try { const existing = JSON.parse(localStorage.getItem(storageKey)); if (existing?.html) { delete existing.html; localStorage.setItem(storageKey, JSON.stringify(existing)); } } catch { /* ignore malformed entries */ }
    }
    localStorage.setItem(key, JSON.stringify(compact));
    return compact;
  }
}
function RegistryQueue({ offers, onClose }) {
  const [skipped, setSkipped] = useState([]);
  const [bridgeStatus, setBridgeStatus] = useState("unknown");
  const [copied, setCopied] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  useEffect(() => { const tick = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))); tick(); const id = setInterval(tick, 250); return () => clearInterval(id); }, [cooldownUntil]);
  const candidates = offers.filter((o) => { if (!o.registrationNumber) return false; try { const saved=JSON.parse(localStorage.getItem(`bilradarn.registry.${o.id}`)||"null"); return saved?.evidence?.status !== "verified"; } catch { return true; } });
  const pending = candidates.filter((o) => !skipped.includes(o.id));
  const current = pending[0];
  const openRegistryWindow = async () => { if (cooldownSeconds > 0) return; try { const response = await fetch(`http://127.0.0.1:8787/start?registration=${encodeURIComponent(current.registrationNumber)}`); if (!response.ok) throw new Error("bridge unavailable"); setBridgeStatus("connected"); } catch { setBridgeStatus("fallback"); window.open(REGISTRY_URL, "bilradarn-transportstyrelsen", "popup,width=980,height=820,resizable=yes,scrollbars=yes"); } };
  const approve = () => { if (!current) return; setSkipped((items) => [...new Set([...items, current.id])]); };
  const importResult = async (event) => { const file = event.target.files?.[0]; if (!file || !current) return; try { const value = JSON.parse(await file.text()); if (value.registrationNumber !== current.registrationNumber || !value.evidence?.sourceUrl) throw new Error("Resultatfilen matchar inte bilen eller saknar källa."); saveRegistryLocally(`bilradarn.registry.${current.id}`, value); approve(); } catch (error) { window.alert(error.message || "Kunde inte läsa resultatfilen."); } event.target.value = ""; };
  const captureAndAdvance = async () => { if (!current) return; try { const response = await fetch("http://127.0.0.1:8787/capture"); if (!response.ok) throw new Error("Ingen aktiv registerkontroll"); const value = await response.json(); if (value.registrationNumber !== current.registrationNumber) throw new Error("Resultatet gäller inte aktuell bil."); saveRegistryLocally(`bilradarn.registry.${current.id}`, value); approve(); setCooldownUntil(Date.now() + 30000); } catch (error) { window.alert(`${error.message || "Kunde inte hämta resultatet."} Använd annars importknappen.`); } };
  return <div className="overlay" role="dialog" aria-modal="true" aria-label="Verifiera fordonsuppgifter"><div className="registry-modal"><div className="modal-header"><div><span className="eyebrow">TRANSPORTSTYRELSEN</span><h2>Verifiera fordonsuppgifter</h2><p>{pending.length ? `${pending.length} bilar saknar sparade registeruppgifter` : "Alla bilar har sparade registeruppgifter"}</p></div><button className="modal-close" onClick={onClose} aria-label="Stäng">×</button></div>{current?<><section className="registry-current"><strong>{current.title}</strong><span>{current.variant}</span><b>Registrering: {current.registrationNumber}</b><small>Öppna sökningen, klicka själv på sök och gå sedan vidare här.</small><div className="registry-frame-fallback"><p>1. Starta den lokala hjälparen för att fylla i numret automatiskt.</p><code className="registry-command">npm.cmd run dev</code><button className="registry-copy" onClick={async()=>{await navigator.clipboard?.writeText("npm.cmd run dev");setCopied(true);setTimeout(()=>setCopied(false),1600);}}>{copied?"Kopierat":"Kopiera startkommando"}</button><p>2. Klicka själv på sök i Transportstyrelsen.</p><button className="registry-open" disabled={cooldownSeconds>0} onClick={openRegistryWindow}>{cooldownSeconds>0?`Nästa sökning om ${cooldownSeconds} s`:"Öppna och fyll registreringsnummer"} {cooldownSeconds===0&&<ArrowSquareOut/>}</button>{bridgeStatus === "fallback"&&<small>Bridge saknas – popupen öppnades som reserv.</small>}</div><label className="registry-import">Importera resultatfil (reserv)<input type="file" accept="application/json,.json" onChange={importResult}/></label></section><div className="registry-actions registry-actions-single"><button className="primary-action" onClick={captureAndAdvance}>{pending.length===1?"Hämta resultat och avsluta":"Hämta resultat och gå vidare"}</button></div></>:<button className="primary-action" onClick={onClose}>Stäng</button>}<p className="registry-note">Huvudknappen hämtar hela den synliga sidan från den lokala hjälparen, sparar registerdata och går vidare till nästa bil.</p></div></div>;
}

function Sidebar({ page, setPage, openOffer, openRegistry }) {
  const best = [...report.leases, ...report.purchases].sort((a, b) => a.economics.total36Sek - b.economics.total36Sek).slice(0, 3);
  const registryPending = [...report.leases, ...report.purchases].filter((offer) => { if (!offer.registrationNumber) return false; try { const saved=JSON.parse(localStorage.getItem(`bilradarn.registry.${offer.id}`)||"null"); return saved?.evidence?.status !== "verified"; } catch { return true; } }).length;
  return <aside className="app-sidebar">
    <div className="brand"><Car weight="duotone" /><strong>Bilradarn</strong><span>LIVE</span></div>
    <nav>
      <button className={page === "ranking" ? "active" : ""} onClick={() => setPage("ranking")}><ChartLine />Rankning</button>
      <button className={page === "compare" ? "active" : ""} onClick={() => setPage("compare")}><Scales />Jämför</button>
      <button className={page === "info" ? "active" : ""} onClick={() => setPage("info")}><FileText />Så räknar vi</button>
    </nav>
    <section className="sidebar-summary"><span>Senaste fulla körning</span><strong>{stamp(report.generatedAt)}</strong><small>{report.purchases.length} köp · {report.leases.length} leasing</small><div><i />Livekällor anslutna</div><small className="enrichment-status">Kostnadsresearch: {enrichmentStatus.pending} väntar · {enrichmentStatus.received} mottagna</small><small className="enrichment-status registry-count">Transportuppgifter: {registryPending} saknar sparade uppgifter</small><button className="registry-queue-button" onClick={openRegistry}><MagnifyingGlass/>Verifiera fordonsuppgifter</button></section>
    <section className="sidebar-picks"><span>Lägst treårskostnad</span>{best.map((offer) => <button key={offer.id} onClick={() => openOffer(offer.id)}>{offer.imageUrls?.[0] ? <img src={offer.imageUrls[0]} alt="" /> : <Car />}<span><b>{offer.kind === "buy" ? "Köp" : "Leasing"}</b>{offer.title}<small>{money(offer.economics.monthlyEconomicSek)}/mån</small></span></button>)}</section>
  </aside>;
}

function OfferCard({ offer, selected, toggle, openOffer }) {
  return <article className={`live-offer ${selected ? "selected" : ""}`}>
    <div className="rank-number">{offer.rank}</div>
    <button className="offer-link" onClick={() => openOffer(offer.id)}>
      <div className="offer-image">{offer.imageUrls?.[0] ? <img src={offer.imageUrls[0]} alt={offer.title} /> : <Car />}</div>
      <div className="offer-copy"><span className="kind-label">{offer.kind === "buy" ? "KÖP" : "PRIVATLEASING"}</span><strong>{offer.title}</strong><small>{offer.variant}</small><span><MapPin weight="fill" />{offer.place || offer.dealer}{offer.distanceKm != null ? ` · ${offer.distanceKm} km` : ""}</span><em>{offer.kind === "buy" ? `${offer.modelYear} · ${new Intl.NumberFormat("sv-SE").format(offer.mileageMil)} mil` : "36 månader · 1 500 mil/år"}</em></div>
    </button>
    <div className="offer-cost"><span>Ekonomisk kostnad, 36 mån</span><strong>{money(offer.economics.total36Sek)}</strong><b>{money(offer.economics.monthlyEconomicSek)}/mån</b><small>Stress {money(offer.economics.stressTotal36Sek)}</small></div>
    <button className="compare-check" onClick={() => toggle(offer.id)}>{selected ? "Vald" : "+ Jämför"}</button>
  </article>;
}

function LegacyRanking({ selected, toggle, openOffer, setPage, query }) {
  const match = (o) => `${o.title} ${o.variant} ${o.dealer}`.toLowerCase().includes(query.toLowerCase());
  return <>
    <header className="page-heading"><div><span className="eyebrow">AKTUELLA ERBJUDANDEN</span><h1>Familjebilar med hela ekonomin synlig</h1><p>Separata listor för köp och leasing. Endast levande källor – inga exempelfordon.</p></div><button className="primary-action" onClick={() => setPage("compare")}><Scales />Jämför valda ({selected.length})</button></header>
    <div className="filter-strip"><span>Göteborg +150 km</span><span>Automat</span><span>Bensin/diesel/ej laddbar hybrid</span><span>2021–2023</span><span>120–250 tkr</span><span>Utrustning kontrolleras men blockerar inte rankning</span></div>
    {report.changes.length > 0 && <div className="change-banner"><Bell weight="fill" /><div><strong>{report.changes.length} förändringar i senaste kontrollen</strong><span>Nya, borttagna eller prisändrade annonser upptäcktes.</span></div></div>}
    <div className="ranking-grid">
      <section className="ranking-panel"><div className="panel-title"><div><span>PRIVATLEASING</span><h2>Aktuella tillverkarerbjudanden</h2></div><p>36 mån · 1 500 mil/år</p></div>{report.leases.filter(match).map((o) => <OfferCard key={o.id} offer={o} selected={selected.includes(o.id)} toggle={toggle} openOffer={openOffer} />)}{report.leases.length === 1 && <p className="list-note">Enbart erbjudanden där 1 500 mil/år kan verifieras tas med i den skarpa listan.</p>}</section>
      <section className="ranking-panel"><div className="panel-title"><div><span>KÖP HOS HANDLARE</span><h2>Kravgodkända liveannonser</h2></div><p>Riskjusterad treårskostnad</p></div>{report.purchases.filter(match).map((o) => <OfferCard key={o.id} offer={o} selected={selected.includes(o.id)} toggle={toggle} openOffer={openOffer} />)}</section>
    </div>
  </>;
}

function seriesPath(values, width, height, max, months = 60) {
  const left = 58, top = 15, right = 16, bottom = 30;
  return values.map((v, i) => `${i ? "L" : "M"}${left + (width - left - right) * i / months},${top + (height - top - bottom) * (1 - v / max)}`).join(" ");
}

function CashflowChart({ offers }) {
  const [month, setMonth] = useState(1), width = 920, height = 280;
  const values = cashflowSeries(offers);
  const max = Math.max(10000, ...values.flat()) * 1.06;
  return <section className="chart-card"><div className="section-heading"><div><h2>Kassaflöde månad för månad</h2><p>Vad som faktiskt lämnar kontot. Leasinglinjen blir 0 efter återlämning månad 36.</p></div><div className="chart-legend">{offers.map((o, i) => <span key={o.id}><i style={{ background: palette[i] }} />{o.title}</span>)}</div></div>
    <div className="chart-scroll"><svg className="data-chart" viewBox={`0 0 ${width} ${height}`} onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMonth(Math.max(0, Math.min(60, Math.round(((e.clientX - r.left) / r.width * width - 58) / 846 * 60)))); }}>
      {[0,.25,.5,.75,1].map((p) => <g key={p}><line x1="58" x2="904" y1={15 + 235*p} y2={15 + 235*p} className="grid-line"/><text x="50" y={19 + 235*p} textAnchor="end">{shortMoney(max*(1-p))}</text></g>)}
      {[0,12,24,36,48,60].map((m) => <text key={m} x={58+846*m/60} y="272" textAnchor="middle">{m===0?"Köpstart":`M${m}`}</text>)}
      {offers.map((o,i)=><path key={o.id} d={seriesPath(values[i],width,height,max)} fill="none" stroke={palette[i]} strokeWidth="3" />)}
      {offers.map((o,i)=><g key={`${o.id}-events`}>{o.economics.events.filter(e=>e.month<=60).map((ev,j)=>{const y=15+235*(1-values[i][ev.month]/max);return <circle key={j} cx={58+846*ev.month/60} cy={y} r="5" fill="#fff" stroke={palette[i]} strokeWidth="3"><title>{ev.label}: {money(ev.amountSek)}</title></circle>})}</g>)}
      {offers.map((o,i)=><g key={`${o.id}-start`}><circle cx="58" cy={15+235*(1-values[i][0]/max)} r="17" fill={palette[i]}/><text x="58" y={19+235*(1-values[i][0]/max)} textAnchor="middle" className="start-label">{shortMoney(values[i][0])}</text></g>)}
      <line x1={58+846*month/60} x2={58+846*month/60} y1="15" y2="250" className="hover-line" />
    </svg></div>
    <div className="chart-inspector"><strong>Månad {month}</strong><div>{offers.map((o,i)=>{const plan=o.kind==="lease"&&month>36?{items:[],totalSek:0}:o.economics.monthlyPlan.find(x=>x.month===month);return <section key={o.id}><h3><i style={{background:palette[i]}}/>{o.title}<b>{money(plan?.totalSek)}</b></h3>{plan?.items?.length ? plan.items.map((item,j)=><p key={j}><span>{item.label}</span><b>{money(item.amountSek)}</b></p>):<p><span>Ingen betalning i kalkylen</span><b>0 kr</b></p>}</section>})}</div></div>
  </section>;
}

function ValueChart({ offers }) {
  const [month,setMonth]=useState(36), purchases = offers.filter(o=>o.kind==="buy"), width=920,height=280;
  if (!purchases.length) return null;
  const { values: vals, debts } = valueDebtSeries(purchases);
  const max=Math.max(...purchases.map(o=>o.priceSek))*1.08;
  return <section className="chart-card"><div className="section-heading"><div><h2>Bilvärde och låneskuld</h2><p>En färgad heldragen linje per bil. Streckad linje i samma färg visar bilens lån.</p></div><div className="chart-legend"><span><i/>Bilvärde</span><span><i className="dash"/>Låneskuld</span></div></div><div className="chart-scroll"><svg className="data-chart" viewBox={`0 0 ${width} ${height}`} onPointerMove={(e)=>{const r=e.currentTarget.getBoundingClientRect();setMonth(Math.max(0,Math.min(60,Math.round(((e.clientX-r.left)/r.width*width-58)/846*60))))}}>
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1="58" x2="904" y1={15+235*p} y2={15+235*p} className="grid-line"/><text x="50" y={19+235*p} textAnchor="end">{shortMoney(max*(1-p))}</text></g>)}
    {[0,12,24,36,48,60].map(m=><text key={m} x={58+846*m/60} y="272" textAnchor="middle">{m===0?"Start":`M${m}`}</text>)}
    {purchases.map((o,i)=><g key={o.id}><path d={seriesPath(vals[i],width,height,max)} fill="none" stroke={palette[offers.indexOf(o)]} strokeWidth="3"/><path d={seriesPath(debts[i],width,height,max)} fill="none" stroke={palette[offers.indexOf(o)]} strokeWidth="2" strokeDasharray="6 5"/><circle cx={58+846*36/60} cy={15+235*(1-o.economics.residual36Sek/max)} r="6" fill="#fff" stroke={palette[offers.indexOf(o)]} strokeWidth="3"><title>{o.title}: restvärde månad 36 {money(o.economics.residual36Sek)}</title></circle></g>)}
    <line x1={58+846*month/60} x2={58+846*month/60} y1="15" y2="250" className="hover-line" />
  </svg></div><div className="value-inspector"><strong>Månad {month}</strong><div>{purchases.map((o,i)=>{const service=o.economics.events.filter(e=>e.month===month);return <section key={o.id}><h3><i style={{background:palette[offers.indexOf(o)]}}/>{o.title}</h3><p><span>Beräknat bilvärde</span><b>{money(vals[i][month])}</b></p><p><span>Kvarvarande låneskuld</span><b>{money(debts[i][month])}</b></p>{service.map((ev,j)=><p key={j}><span>{ev.label}</span><b>{money(ev.amountSek)}</b></p>)}</section>})}</div></div><div className="value-list">{purchases.map((o)=><div key={o.id}><i style={{background:palette[offers.indexOf(o)]}}/><strong>{o.title}</strong><span>M36 privatvärde {money(o.economics.residual36Sek)}</span><span>försiktigt inbyte {money(o.economics.tradeIn36Sek)}</span><span>skuld {money(o.economics.debt36Sek)}</span></div>)}</div></section>;
}

function BreakdownMatrix({ offers }) {
  const keys=[...new Set(offers.flatMap(o=>o.economics.breakdown.map(r=>r.key)))];
  return <section className="matrix-card"><div className="section-heading"><div><h2>Komplett kostnadsbro</h2><p>Minustecken betyder ett värde du fortfarande äger efter 36 månader.</p></div></div><div className="matrix-scroll"><table><thead><tr><th>Kostnadspost</th>{offers.map(o=><th key={o.id}>{o.title}<small>{o.kind==="buy"?"Köp":"Leasing"}</small></th>)}</tr></thead><tbody>{keys.map(key=><tr key={key}><td>{offers.flatMap(o=>o.economics.breakdown).find(r=>r.key===key)?.label}</td>{offers.map(o=>{const row=o.economics.breakdown.find(r=>r.key===key);return <td key={o.id} className={row?.amountSek<0?"credit":""}>{row?<><b>{money(row.amountSek)}</b><Evidence evidence={row.evidence}/><small>{row.evidence.note}</small></>:"—"}</td>})}</tr>)}<tr className="matrix-total"><td><strong>Ekonomisk treårskostnad</strong></td>{offers.map(o=><td key={o.id}><b>{money(o.economics.total36Sek)}</b><strong>{money(o.economics.monthlyEconomicSek)}/mån</strong></td>)}</tr></tbody></table></div></section>;
}

function Compare({ selected, setSelected, openOffer }) {
  const all=[...report.leases,...report.purchases];
  const chosen=chooseOffers(all, selected);
  const toggle=(id)=>setSelected(s=>toggleOffer(s, id));
  return <><header className="page-heading"><div><span className="eyebrow">JÄMFÖRELSE</span><h1>Jämför upp till fem bilar</h1><p>Varje kolumn och varje linje hör till en verklig annons eller ett aktuellt erbjudande.</p></div></header>
    <div className="compare-picker">{all.map(o=><button key={o.id} className={chosen.some(x=>x.id===o.id)?"active":""} onClick={()=>toggle(o.id)}><strong>{o.kind==="buy"?"Köp":"Leasing"} · {o.title}</strong><small>{o.kind==="buy"?`${money(o.priceSek)} · ${new Intl.NumberFormat("sv-SE").format(o.mileageMil)} mil`:`${money(o.monthlyFeeSek)}/mån · 1 500 mil/år`} · {o.transmission||"Automat"}</small></button>)}</div>
    <div className="comparison-totals">{chosen.map((o,i)=><button key={o.id} onClick={()=>openOffer(o.id)} style={{borderTopColor:palette[i]}}><span>{o.kind==="buy"?"KÖP":"LEASING"}</span><strong>{o.title}</strong><b>{money(o.economics.total36Sek)}</b><small>{money(o.economics.monthlyEconomicSek)}/mån · stress {money(o.economics.stressTotal36Sek)}</small></button>)}</div>
    <CashflowChart offers={chosen}/><ValueChart offers={chosen}/><BreakdownMatrix offers={chosen}/></>;
}

function Gallery({ offer }) {
  const [image,setImage]=useState(0), [open,setOpen]=useState(false), images=offer.imageUrls||[];
  useEffect(()=>{ if(!open) return; const onKey=(event)=>{ if(event.key==="Escape") setOpen(false); if(event.key==="ArrowRight") setImage((current)=>(current+1)%images.length); if(event.key==="ArrowLeft") setImage((current)=>(current-1+images.length)%images.length); }; window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey); },[open,images.length]);
  return <div className="gallery"><button className="gallery-main" onClick={()=>images.length&&setOpen(true)} aria-label="Öppna stort bildspel">{images[image]?<img src={images[image]} alt={`${offer.title}, bild ${image+1}`}/>:<Car/>}<span><Camera/>{images.length} annonsbilder · klicka för större</span></button>{images.length>1&&<div className="thumb-row">{images.map((src,i)=><button key={`${src}-${i}`} className={i===image?"active":""} onClick={()=>setImage(i)}><img src={src} alt={`Visa bild ${i+1}`}/></button>)}</div>}{open&&<div className="gallery-modal" role="dialog" aria-modal="true" aria-label={`${offer.title}, bildspel`} onClick={()=>setOpen(false)}><div className="gallery-modal-inner" onClick={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setOpen(false)} aria-label="Stäng bildspel">×</button><button className="modal-arrow prev" onClick={()=>setImage((current)=>(current-1+images.length)%images.length)} aria-label="Föregående bild">‹</button><img src={images[image]} alt={`${offer.title}, bild ${image+1} av ${images.length}`} /><button className="modal-arrow next" onClick={()=>setImage((current)=>(current+1)%images.length)} aria-label="Nästa bild">›</button><div className="modal-caption">{offer.title} · Bild {image+1} av {images.length}</div><div className="modal-thumbs">{images.map((src,i)=><button key={`${src}-modal-${i}`} className={i===image?"active":""} onClick={()=>setImage(i)}><img src={src} alt="" /></button>)}</div></div></div>}</div>;
}

function extractClientRegistryFields(text) { const pattern=/^(?:\(\d+\*\))?(Registreringsnummer|Fabrikat|Handelsbeteckning|Fordonsstatus|Färg|Fordonsår|Fordonet tillverkat|Fordonslag|Fordonsslag|Fordons[slags]*klass|Fordonskategori|Besiktas senast|Senast godkända besiktning|Mätarställning|Användningsförbud|Påställt första gången i Sverige|Registreringsdatum|Import\/införsel|Fordonsskattepliktigt|Årsskatt|Vägtrafikregisteravgift|Betalningsmånad\/er|Debitering vid påställning \(inkl\. avgifter\)|Trängselskattepliktigt|Antal brukare|Förvärvsdatum|Försäkringsbolag|Försäkringsdatum|Identifieringsnummer|Typgodkännandenummer|Typgodkännandedatum|Typ|Variant|Version|Skyltformat, fram|Skyltformat, bak|Senaste utfärdade registreringsbevis del [12]|Kaross|Längd|Bredd|Höjd|Tjänstevikt(?: \(faktisk vikt\))?|Max lastvikt|Totalvikt|Ursprunglig totalvikt|Skattevikt|Antal axlar|Max axelavstånd axel 1-2|Spårvidd|Däckdimension|Fälgdimension|Största belastning koppling fordon|Max släpvagnsvikt|Max släpvikt, obromsad|Max sammanlagd bruttovikt \(tågvikt\)|Antal passagerare, max|Drivmedel|Växellåda|Effekt, max \(för elmotor\)|Motoreffekt|Slagvolym|Euroklassning|Miljöklass|Utsläppsklass|Elfordon|Effektnorm|Max hastighet|Ljudnivå stillastående|Varvtal stillastående|Ljudnivå vid körning|Avgasdirektiv\/reglemente|Landsvägskörning|Stadskörning|Blandad körning|Låg|Medium|Hög|Extra hög|Kolmonoxid, CO|Totala kolväten, THC|Ickemetankolväten, NMHC|Kväveoxider, NOx|Antal partiklar)$/i; const lines=(text||"").split(/\r?\n/).map((line)=>line.replace(/\s+/g," ").trim()).filter(Boolean); const fields=[]; for(let i=0;i<lines.length-1;i+=1){const label=lines[i].replace(/^\(\d+\*\)/,""); if(pattern.test(lines[i])&&lines[i+1]&&!fields.some((field)=>field.label===label)){fields.push({label,value:lines[i+1]});i+=1;}} return fields; }
function registryFieldValue(registry, patterns, fields = registry?.fields) { const field = fields?.find((item) => patterns.some((pattern) => pattern.test(item.label))); return field?.value || null; }
function RegistryPanel({ offer }) {
  const storageKey = `bilradarn.registry.${offer.id}`;
  const [registry, setRegistry] = useState(() => { try { const value = JSON.parse(localStorage.getItem(storageKey) || "null"); if (!value?.rawText) return value; const labelPattern=/^(?:\(\d+\*\))?(Registreringsnummer|Fabrikat|Handelsbeteckning|Fordonsstatus|Färg|Fordonsår|Fordonet tillverkat|Fordonslag|Besiktas senast|Användningsförbud|Senaste besiktning|Giltig till|Fordonsskatt|Årlig fordonsskatt|Koldioxidutsläpp|CO₂|CO2|Antal tidigare ägare|Tidigare ägare)$/i; const lines=value.rawText.split(/\r?\n/).map((line)=>line.replace(/\s+/g," ").trim()).filter(Boolean); const fields=[]; for(let i=0;i<lines.length-1;i+=1){const label=lines[i].replace(/^\(\d+\*\)/,""); const fieldValue=lines[i+1]; if(labelPattern.test(lines[i])&&fieldValue&&!fields.some((field)=>field.label===label)){fields.push({label,value:fieldValue});i+=1;}} const find=(pattern)=>{const match=value.rawText.match(pattern);return match?match[1].trim():null;}; const upgraded={...value,fields,modelYear:value.modelYear??(find(/fordonsår[^\d]*(20\d{2})/i)?Number(find(/fordonsår[^\d]*(20\d{2})/i)):null),firstTrafficDate:value.firstTrafficDate??find(/fordonet tillverkat[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i),inspection:{...value.inspection,validUntil:value.inspection?.validUntil??find(/besiktas senast[^\d]*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i)}}; localStorage.setItem(storageKey,JSON.stringify(upgraded)); return upgraded; } catch { return null; } });
  const [raw, setRaw] = useState("");
  const [error, setError] = useState(null);
  const save = () => {
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || value.registrationNumber !== offer.registrationNumber) throw new Error("Registreringsnumret måste matcha annonsen.");
      if (!value.evidence?.sourceUrl || !value.evidence?.checkedAt) throw new Error("Käll-URL och kontrolltid krävs.");
      if (value.evidence.status !== "verified" && value.evidence.status !== "partially_verified") throw new Error("Registerresultatet måste vara verifierat eller delvis verifierat.");
      const saved = saveRegistryLocally(storageKey, value); setRegistry(saved); setRaw(""); setError(null);
    } catch (e) { setError(e.message || "Ogiltig JSON"); }
  };
  const openSavedHtml = () => { if (!registry?.html) return; const url = URL.createObjectURL(new Blob([registry.html], { type: "text/html;charset=utf-8" })); window.open(url, "bilradarn-registry-html", "popup,width=1100,height=850,scrollbars=yes"); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  const allFields = registry?.rawText ? extractClientRegistryFields(registry.rawText) : (registry?.fields || []);
  const fallback = (patterns) => registryFieldValue(registry, patterns, allFields);
  const fieldSection = (label) => {
    if (/brukare|förvärv|försäkring/i.test(label)) return "Ägare och försäkring";
    if (/identifierings|typgodkännande|skyltformat|registreringsbevis/i.test(label)) return "Fordonsidentitet";
    if (/status|registreringsdatum|påställt|import|användningsförbud/i.test(label)) return "Status";
    if (/besikt|mätarställning/i.test(label)) return "Besiktning";
    if (/skatt|avgift|betalningsmånad|trängselskat|debitering/i.test(label)) return "Skatt och avgifter";
    if (/kaross|längd|bredd|höjd|vikt|axel|spårvidd|däck|fälg|släp|koppling|passagerare/i.test(label)) return "Mått, vikt och släp";
    if (/växellåda|slagvolym|drivmedel|effekt|motor|euro|utsläppsklass|elfordon|hastighet|ljud|varvtal/i.test(label)) return "Motor och miljö";
    if (/koldioxid|lands|stad|blandad|låg|medium|hög|extra hög|kolmonoxid|kolväten|kväve|partiklar|bränsleförbrukning/i.test(label)) return "Utsläpp och förbrukning";
    return "Sammanfattning";
  };
  const groupedFields = allFields.reduce((groups, field) => { const section = fieldSection(field.label); (groups[section] ||= []).push(field); return groups; }, {});
  const ownerValue = fallback([/tidigare.*ägare/i]) || (registry?.previousOwners !== 2026 ? registry?.previousOwners : null);
  return <section className="registry-panel detail-card span-two"><div className="registry-panel-heading"><div><h2>Fordonsregister</h2><p>Uppgifter från Transportstyrelsens sökning för {offer.registrationNumber || "saknat registreringsnummer"}.</p></div><div className="registry-panel-actions">{registry?.html&&<button className="registry-html" onClick={openSavedHtml}>Visa sparad HTML</button>}<a href="https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/" target="_blank" rel="noreferrer">Öppna e-tjänsten <ArrowSquareOut/></a></div></div>{registry?<div className="registry-data"><dl>{[["Registreringsnummer",registry.registrationNumber],["Första trafikdatum",registry.firstTrafficDate||fallback([/första.*trafik/i,/tillverkat/i])],["CO₂",registry.co2Gkm!=null?`${registry.co2Gkm} g/km`:fallback([/co2|koldioxid/i])],["Årsskatt",registry.annualTaxSek!=null?money(registry.annualTaxSek):fallback([/fordonsskatt|årsskatt/i])],["Tidigare ägare",ownerValue],["Senaste besiktning",registry.inspection?.lastDate||fallback([/senaste.*besikt/i])],["Besiktning giltig till",registry.inspection?.validUntil||fallback([/besiktas senast|giltig till/i])]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value==null?"Ej uppgift":value}</dd></div>)}</dl>{allFields.length>0&&<details className="registry-extra" open><summary>Alla sparade etiketter och värden ({allFields.length})</summary>{Object.entries(groupedFields).map(([section,fields])=><div className="registry-field-group" key={section}><h3>{section}</h3><dl>{fields.map((field,index)=><div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></div>)}</details>}<Evidence evidence={registry.evidence}/><small>Sparad lokalt {registry.evidence.checkedAt}</small></div>:<div className="registry-empty"><WarningCircle/><p>Inga registeruppgifter är sparade ännu. Gör uppslaget i Transportstyrelsens e-tjänst och klistra sedan in JSON enligt formatet nedan.</p><pre>{`{"registrationNumber":"${offer.registrationNumber||"ABC123"}","annualTaxSek":null,"co2Gkm":null,"firstTrafficDate":null,"previousOwners":null,"evidence":{"status":"verified","sourceUrl":"https://...","checkedAt":"2026-09-08T12:00:00Z"}}`}</pre><textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Klistra in registerresultat som JSON…"/><button className="primary-action" onClick={save}>Spara registeruppgifter</button>{error&&<strong className="registry-error">{error}</strong>}</div>}</section>;
}

function OfferDetail({ offer, back }) {
  const [tab,setTab]=useState("economy");
  const facts=[offer.registrationNumber&&["Registrering",offer.registrationNumber],offer.modelYear&&["Modellår",offer.modelYear],offer.mileageMil!=null&&["Mätarställning",`${new Intl.NumberFormat("sv-SE").format(offer.mileageMil)} mil`],["Drivmedel",offer.fuelType],["Växellåda",offer.transmission||"Automat"],offer.consumptionL100Km&&["WLTP",`${offer.consumptionL100Km} l/100 km`],offer.annualTaxSek!=null&&["Skatt/år",money(offer.annualTaxSek)],["Säljare",offer.dealer]].filter(Boolean);
  return <div className="detail-page"><button className="back-button" onClick={back}><ArrowLeft/>Tillbaka</button><section className="detail-hero"><Gallery offer={offer}/><div className="detail-title"><span className="kind-label">{offer.kind==="buy"?"KÖP HOS HANDLARE":"PRIVATLEASING"}</span><h1>{offer.title}</h1><p>{offer.variant}</p><span><MapPin weight="fill"/>{offer.place||offer.dealer}{offer.distanceKm!=null?` · ${offer.distanceKm} km`:""}</span><a className="external" href={offer.sourceUrl} target="_blank" rel="noreferrer">Öppna originalkällan <ArrowSquareOut/></a></div><div className="detail-price"><span>{offer.kind==="buy"?"Annonspris":"Leasingavgift"}</span><strong>{offer.kind==="buy"?money(offer.priceSek):`${money(offer.monthlyFeeSek)}/mån`}</strong><b>{money(offer.economics.monthlyEconomicSek)}/mån totalt ekonomiskt</b><small>Tre år {money(offer.economics.total36Sek)}</small><em>Stresscenario {money(offer.economics.stressTotal36Sek)}</em></div></section>
    <div className="quick-facts">{facts.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    {offer.registrationNumber&&<section className="registry-lookup"><div><strong>Verifiera fordonsuppgifter</strong><p>Öppna Transportstyrelsens officiella sökning och kontrollera skatt, CO₂, första trafikdatum och besiktning för {offer.registrationNumber}.</p></div><a href="https://fordon-fu-regnr.transportstyrelsen.se/UppgifterAnnatFordon/" target="_blank" rel="noreferrer">Öppna uppslag <ArrowSquareOut/></a></section>}
    <nav className="detail-tabs"><button className={tab==="economy"?"active":""} onClick={()=>setTab("economy")}>Ekonomisk plan</button><button className={tab==="listing"?"active":""} onClick={()=>setTab("listing")}>Annons & utrustning</button><button className={tab==="registry"?"active":""} onClick={()=>setTab("registry")}>Fordonsregister</button><button className={tab==="sources"?"active":""} onClick={()=>setTab("sources")}>Källor & osäkerhet</button></nav>
    {tab==="economy"&&<><div className="plain-explainer"><div><strong>Ekonomisk kostnad</strong><b>{money(offer.economics.total36Sek)}</b><span>Det som förbrukas under tre år. För köp dras bilens kvarvarande värde av.</span></div><i/><div><strong>Pengar som lämnar kontot</strong><b>{money(offer.economics.cashPaid36Sek)}</b><span>Kontantinsats, amortering och alla löpande betalningar. Bilvärdet är fortfarande en tillgång.</span></div></div>
      <BreakdownMatrix offers={[offer]}/><CashflowChart offers={[offer]}/>{offer.kind==="buy"&&<ValueChart offers={[offer]}/>}<section className="payment-section chart-card"><div className="section-heading"><div><h2>Alla betalningar, månad för månad</h2><p>Öppna en månad för att se exakt vad beloppet består av.</p></div><span>{offer.economics.monthlyPlan.length} månader</span></div><div className="payment-table">{offer.economics.monthlyPlan.map(m=><details key={m.month}><summary><b>{m.month===0?"Vid köp/start":`Månad ${m.month}`}</b><span>{m.items.map(i=>i.label).join(" · ")||"Ingen betalning"}</span><strong>{money(m.totalSek)}</strong></summary><div>{m.items.map((i,j)=><p key={j}><span>{i.label}</span><b>{money(i.amountSek)}</b></p>)}</div></details>)}</div></section></>}
    {tab==="listing"&&<div className="detail-grid"><section className="detail-card"><h2>Det här vet vi från annonsen</h2><dl>{facts.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section><section className="detail-card"><h2>Utrustningsstatus</h2><p>Grön = bekräftad i annonsen. Gul = uppgiften kunde inte verifieras, men bilen är fortfarande rankad.</p><ul className="requirements">{Object.entries(offer.requiredEquipment||{}).map(([k,v])=><li key={k} className={v?"ok":"missing"}>{v?<CheckCircle weight="fill"/>:<WarningCircle weight="fill"/>}{({antisladd:"Antisladd",isofix:"ISOFIX",parking:"Parkeringssensorer",camera:"Back-/360-kamera"})[k]} {!v&&" · ej verifierat"}</li>)}</ul></section><section className="detail-card span-two"><h2>All utrustning som fångats från säljsidan</h2><ul className="equipment-list">{offer.equipment?.map(item=><li key={item}><CheckCircle/>{item}</li>)}</ul></section></div>}
    {tab==="registry"&&<RegistryPanel offer={offer}/>} 
    {tab==="sources"&&<div className="detail-grid"><section className="detail-card span-two"><h2>Post för post</h2><div className="source-list">{offer.economics.breakdown.map(row=><article key={row.key}><Evidence evidence={row.evidence}/><div><strong>{row.label}</strong><p>{row.evidence.note||"Värdet kommer direkt från angiven källa."}</p></div><b>{money(row.amountSek)}</b>{row.evidence.sourceUrl&&<a href={row.evidence.sourceUrl} target="_blank" rel="noreferrer"><ArrowSquareOut/></a>}</article>)}</div></section><section className="detail-card span-two"><h2>Viktigt innan avtal</h2><ul>{offer.quality.warnings?.map(x=><li key={x}>{x}</li>)}</ul></section></div>}
  </div>;
}

export function App() {
  const [scenario, setScenario] = useState(() => readScenario(report.parameters));
  useEffect(() => { const hash = window.location.hash; const offers = [...report.leases, ...report.purchases]; if (hash === "#reset-registry") offers.forEach((offer) => localStorage.removeItem(`bilradarn.registry.${offer.id}`)); else if (hash.startsWith("#reset-registry-registration=")) { const registration = decodeURIComponent(hash.split("=")[1] || "").toUpperCase(); offers.filter((offer) => offer.registrationNumber?.toUpperCase() === registration).forEach((offer) => localStorage.removeItem(`bilradarn.registry.${offer.id}`)); } else return; window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }, []);
  useEffect(() => { const refresh = () => setScenario(readScenario(report.parameters)); window.addEventListener("bilradarn-settings-changed", refresh); return () => window.removeEventListener("bilradarn-settings-changed", refresh); }, []);
  const snapshot = useMemo(() => { const base = getReportSnapshot(); const purchases = base.purchases.map((offer) => applyScenario(offer, scenario, report.parameters.fuelPriceSekPerLitre.Bensin)); const leases = base.leases.map((offer) => applyScenario(offer, scenario, report.parameters.fuelPriceSekPerLitre.Bensin)); report.purchases = purchases; report.leases = leases; return { ...base, offers: [...leases, ...purchases], purchases, leases }; }, [scenario]);
  const all=snapshot.offers, [page,setPage]=useState("ranking"), [selected,setSelected]=useState([snapshot.leases[0]?.id,snapshot.purchases[0]?.id].filter(Boolean)), [detail,setDetail]=useState(null), [query,setQuery]=useState("");
  const offer=all.find(x=>x.id===detail); const [registryOpen,setRegistryOpen]=useState(false); const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<5?[...s,id]:s); const openOffer=id=>setDetail(id);
  return <div className="prototype-shell"><Sidebar page={page} setPage={(p)=>{setDetail(null);setPage(p)}} openOffer={openOffer} openRegistry={()=>setRegistryOpen(true)}/><main className="app-main"><div className="topbar"><label className="search"><MagnifyingGlass/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Sök modell, handlare eller utrustning"/></label><span className="status-dot"><i/>Uppdaterad {stamp(report.generatedAt)}</span></div><div className="content">{offer?<OfferDetail offer={offer} back={()=>setDetail(null)}/>:page==="ranking"?<Ranking selected={selected} toggle={toggle} openOffer={openOffer} setPage={setPage} query={query}/>:page==="compare"?<Compare selected={selected} setSelected={setSelected} openOffer={openOffer}/>:<Info/>}</div></main>{registryOpen&&<RegistryQueue offers={all} onClose={()=>setRegistryOpen(false)}/>}</div>;
}

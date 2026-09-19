const APPROXIMATE_DRIVING_DISTANCE_FROM_GOTHENBURG_KM = {
  "alingsas": 50,
  "borlange": 460,
  "boras": 65,
  "enkoping": 390,
  "eskilstuna": 360,
  "goteborg": 0,
  "habo": 145,
  "halmstad": 140,
  "helsingborg": 220,
  "jarfalla": 480,
  "jonkoping": 145,
  "kalmar": 340,
  "kareby": 30,
  "karlskrona": 350,
  "kinna": 60,
  "kista": 480,
  "kungsbacka": 30,
  "kungalv": 25,
  "lanna": 485,
  "lidkoping": 130,
  "lilla edet": 55,
  "linkoping": 275,
  "lund": 265,
  "malmo": 275,
  "molndal": 10,
  "nacka": 485,
  "nykoping": 385,
  "orebro": 280,
  "osterhaninge": 500,
  "segelstorp": 475,
  "stenungsund": 50,
  "strangnas": 400,
  "sundsvall": 790,
  "taby": 490,
  "upplands vasby": 500,
  "uppsala": 530,
  "vanersborg": 90,
  "varberg": 75,
  "vasteras": 380,
  "vaxjo": 230,
  "varnamo": 175,
};

function normalizePlace(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function resolveTravelDistance(offer) {
  const reported = Number(offer?.distanceKm);
  if (Number.isFinite(reported) && reported > 0) return { km: Math.round(reported), approximate: false };

  const location = normalizePlace(`${offer?.place ?? ""} ${offer?.dealer ?? ""}`);
  const place = Object.keys(APPROXIMATE_DRIVING_DISTANCE_FROM_GOTHENBURG_KM)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => location.includes(candidate));
  if (!place) return null;
  return { km: APPROXIMATE_DRIVING_DISTANCE_FROM_GOTHENBURG_KM[place], approximate: true };
}

export function travelDistanceBand(distance) {
  if (!distance || distance.km < 0) return null;
  if (distance.km <= 100) return { className: "near-10", label: "≤10 mil", description: "Inom 10 mil från Göteborg" };
  if (distance.km <= 150) return { className: "near-15", label: "10–15 mil", description: "Mellan 10 och 15 mil från Göteborg" };
  return null;
}

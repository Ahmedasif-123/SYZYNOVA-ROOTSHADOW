const sites = [{"id":"us_sgp_goodwell","coordinates":[-101.618,36.597]},{"id":"us_sgp_stillwater","coordinates":[-97.091,36.118]},{"id":"australia_narrabri","coordinates":[149.783,-30.325]},{"id":"spain_cordoba","coordinates":[-4.779,37.888]},{"id":"argentina_pampas","coordinates":[-61,-35]},{"id":"southern_africa","coordinates":[25,-27]},{"id":"qatar_doha","coordinates":[51.531,25.2854]},{"id":"qatar_dukhān","coordinates":[50.78,25.43]},{"id":"saudi_riyadh","coordinates":[46.6753,24.7136]},{"id":"saudi_jeddah","coordinates":[39.1728,21.5433]},{"id":"saudi_hail","coordinates":[41.7,27.52]},{"id":"uae_abu_dhabi","coordinates":[54.3773,24.4539]},{"id":"uae_al_ain","coordinates":[55.75,24.2]},{"id":"oman_muscat","coordinates":[58.3829,23.588]},{"id":"oman_nizwa","coordinates":[57.53,22.93]},{"id":"kuwait_al_jahra","coordinates":[47.68,29.35]},{"id":"bahrain_riffa","coordinates":[50.56,26.13]},{"id":"iraq_baghdad","coordinates":[44.3661,33.3152]},{"id":"iraq_mosul","coordinates":[43.13,36.34]},{"id":"jordan_amman","coordinates":[35.9106,31.9539]},{"id":"lebanon_bekaa","coordinates":[36.03,33.85]},{"id":"syria_aleppo","coordinates":[37.16,36.2]},{"id":"yemen_sanaa","coordinates":[44.191,15.3694]},{"id":"iran_isfahan","coordinates":[51.668,32.6546]},{"id":"iran_shiraz","coordinates":[52.58,29.59]},{"id":"turkey_konya","coordinates":[32.49,37.87]},{"id":"turkey_sanliurfa","coordinates":[38.79,37.16]},{"id":"israel_beersheba","coordinates":[34.79,31.25]},{"id":"palestine_jenin","coordinates":[35.3,32.46]},{"id":"egypt_faiyum","coordinates":[30.84,29.31]},{"id":"egypt_aswan","coordinates":[32.9,24.09]},{"id":"morocco_marrakesh","coordinates":[-8,31.63]},{"id":"morocco_fez","coordinates":[-4.99,34.06]},{"id":"algeria_tlemcen","coordinates":[-1.32,34.88]},{"id":"tunisia_kairouan","coordinates":[10.1,35.68]},{"id":"libya_sabha","coordinates":[14.43,27.04]},{"id":"sudan_khartoum","coordinates":[32.56,15.5]},{"id":"ethiopia_addis_ababa","coordinates":[38.76,9]},{"id":"kenya_nakuru","coordinates":[36.07,-0.3]},{"id":"uganda_kampala","coordinates":[32.58,0.35]},{"id":"nigeria_kano","coordinates":[8.52,12]},{"id":"ghana_kumasi","coordinates":[-1.62,6.69]},{"id":"senegal_thies","coordinates":[-16.93,14.79]},{"id":"zambia_lusaka","coordinates":[28.28,-15.42]},{"id":"zimbabwe_bulawayo","coordinates":[28.58,-20.16]},{"id":"south_africa_pretoria","coordinates":[28.23,-25.747]},{"id":"madagascar_antananarivo","coordinates":[47.51,-18.88]},{"id":"india_delhi","coordinates":[77.209,28.6139]},{"id":"india_nagpur","coordinates":[79.0882,21.1458]},{"id":"india_hyderabad","coordinates":[78.4867,17.385]},{"id":"pakistan_lahore","coordinates":[74.36,31.52]},{"id":"pakistan_multan","coordinates":[71.52,30.16]},{"id":"bangladesh_rajshahi","coordinates":[88.6,24.37]},{"id":"nepal_kathmandu","coordinates":[85.32,27.71]},{"id":"china_beijing","coordinates":[116.4,39.9]},{"id":"china_chengdu","coordinates":[104.07,30.57]},{"id":"japan_sapporo","coordinates":[141.35,43.06]},{"id":"south_korea_daejeon","coordinates":[127.38,36.35]},{"id":"thailand_chiang_mai","coordinates":[98.98,18.78]},{"id":"vietnam_hanoi","coordinates":[105.85,21.03]},{"id":"indonesia_yogyakarta","coordinates":[110.37,-7.8]},{"id":"philippines_davao","coordinates":[125.61,7.07]},{"id":"kazakhstan_astana","coordinates":[71.43,51.17]},{"id":"uzbekistan_samarkand","coordinates":[66.96,39.65]},{"id":"uk_cambridge","coordinates":[0.12,52.2]},{"id":"france_toulouse","coordinates":[1.44,43.6]},{"id":"germany_hanover","coordinates":[9.73,52.38]},{"id":"netherlands_wageningen","coordinates":[5.67,51.97]},{"id":"italy_bologna","coordinates":[11.34,44.49]},{"id":"spain_zaragoza","coordinates":[-0.88,41.65]},{"id":"portugal_evora","coordinates":[-7.91,38.57]},{"id":"greece_larissa","coordinates":[22.42,39.64]},{"id":"poland_lublin","coordinates":[22.57,51.25]},{"id":"romania_cluj","coordinates":[23.6,46.77]},{"id":"us_nebraska_lincoln","coordinates":[-96.7,40.81]},{"id":"us_california_fresno","coordinates":[-119.79,36.74]},{"id":"us_iowa_ames","coordinates":[-93.62,42.03]},{"id":"us_arizona_tucson","coordinates":[-110.97,32.22]},{"id":"us_georgia_athens","coordinates":[-83.38,33.95]},{"id":"canada_saskatoon","coordinates":[-106.67,52.13]},{"id":"canada_guelph","coordinates":[-80.25,43.54]},{"id":"mexico_guanajuato","coordinates":[-101.26,21.02]},{"id":"mexico_hermosillo","coordinates":[-110.96,29.07]},{"id":"colombia_bogota","coordinates":[-74.07,4.71]},{"id":"peru_cusco","coordinates":[-71.97,-13.53]},{"id":"brazil_campinas","coordinates":[-47.06,-22.9]},{"id":"brazil_cuiaba","coordinates":[-56.1,-15.6]},{"id":"chile_talca","coordinates":[-71.66,-35.43]},{"id":"argentina_rosario","coordinates":[-60.66,-32.95]},{"id":"uruguay_durazno","coordinates":[-56.52,-33.38]},{"id":"bolivia_cochabamba","coordinates":[-66.16,-17.39]},{"id":"australia_melbourne","coordinates":[144.96,-37.81]},{"id":"australia_perth","coordinates":[115.86,-31.95]},{"id":"australia_toowoomba","coordinates":[151.95,-27.56]},{"id":"australia_wagga_wagga","coordinates":[147.37,-35.11]},{"id":"new_zealand_hamilton","coordinates":[175.28,-37.79]},{"id":"new_zealand_christchurch","coordinates":[172.63,-43.53]}];

export const maxDuration = 60;

type ClimateMonth = { month: string; t2m: number; precip: number };
type Scenario = "ssp126" | "ssp245" | "ssp370";
const HIST = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const FUTURE = "https://power.larc.nasa.gov/api/projection/monthly/point";

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function readSeries(raw: unknown, key: "T2M" | "PRECTOTCORR", scenario?: Scenario): Record<string, number> {
  const body = raw as { properties?: { parameter?: Record<string, unknown> } };
  const field = body?.properties?.parameter?.[key];
  if (!field || typeof field !== "object" || Array.isArray(field)) throw new Error("Missing NASA parameter " + key);
  const data = scenario ? (field as Record<string, unknown>)[scenario] : field;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Missing NASA scenario " + scenario);
  const entries: Record<string, number> = {};
  for (const [date, value] of Object.entries(data)) {
    if (!/^\d{6}$/.test(date)) continue;
    if (typeof value === "number" && Number.isFinite(value) && value > -900 && value < 10000) entries[date] = value;
  }
  return entries;
}

function paired(raw: unknown, scenario?: Scenario): ClimateMonth[] {
  const temp = readSeries(raw, "T2M", scenario);
  const rain = readSeries(raw, "PRECTOTCORR", scenario);
  return Object.keys(temp).filter(month => month in rain)
    .sort()
    .map(month => ({ month: month.slice(0, 4) + "-" + month.slice(4), t2m: temp[month], precip: rain[month] }))
    .filter(row => row.t2m > -90 && row.t2m < 75 && row.precip >= 0 && row.precip < 200);
}

async function getPower(url: URL): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(48000) });
  if (!response.ok) throw new Error("NASA POWER returned HTTP " + response.status);
  return await response.json();
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("siteId");
  const rawScenario = url.searchParams.get("scenario") ?? "ssp245";
  if (rawScenario !== "ssp126" && rawScenario !== "ssp245" && rawScenario !== "ssp370") return reply({ error: "Invalid climate scenario" }, 400);
  const scenario: Scenario = rawScenario;
  const site = sites.find(item => item.id === id);
  if (!site) return reply({ error: "Choose one of the 97 supported model locations." }, 400);

  const [lon, lat] = site.coordinates;
  const shared = {
    parameters: "T2M,PRECTOTCORR",
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    format: "JSON"
  };
  const past = new URL(HIST);
  for (const [key, value] of Object.entries(shared)) past.searchParams.set(key, value);
  past.searchParams.set("start", "1981");
  past.searchParams.set("end", "2025");

  const future = new URL(FUTURE);
  for (const [key, value] of Object.entries(shared)) future.searchParams.set(key, value);
  future.searchParams.set("start", "201501");
  future.searchParams.set("end", "205512");
  future.searchParams.set("scenario", scenario);
  future.searchParams.set("model", "ensemble");
  future.searchParams.set("time-standard", "UTC");

  try {
    const [rawPast, rawFuture] = await Promise.all([getPower(past), getPower(future)]);
    const history = paired(rawPast).filter(row => row.month >= "1981-01" && row.month <= "2025-12");
    const projection = paired(rawFuture).filter(row => row.month >= "2015-01" && row.month <= "2055-12");
    if (history.length < 480 || projection.length < 400) {
      return reply({ error: "NASA climate dataset is incomplete at this grid point. No projection has been generated.",
        historyMonths: history.length, scenarioMonths: projection.length }, 503);
    }
    return reply({
      schema: 1,
      siteId: site.id,
      scenario,
      historicalStart: "1981-01",
      historicalEnd: "2025-12",
      climateEnsemble: "NASA NEX-GDDP-CMIP6",
      history,
      projection,
      coordinates: { lon, lat },
      variables: { t2m: "°C", precip: "mm/day, monthly mean" },
      sources: {
        historical: past.toString(),
        future: future.toString(),
        documentation: "https://power.larc.nasa.gov/docs/services/api/projection/"
      },
      caution: "CMIP6 scenarios are possible climate pathways, not observed future conditions. Model grid cells are not farm measurements."
    });
  } catch {
    return reply({ error: "NASA POWER climate inputs could not be retrieved. Future climate estimates are withheld." }, 503);
  }
}

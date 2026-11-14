import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const originalSites = ["us_sgp_goodwell","us_sgp_stillwater","australia_narrabri","spain_cordoba","argentina_pampas","southern_africa"];
const additionalSites = ["qatar_doha","qatar_dukhān","saudi_riyadh","saudi_jeddah","saudi_hail","uae_abu_dhabi","uae_al_ain","oman_muscat","oman_nizwa","kuwait_al_jahra","bahrain_riffa","iraq_baghdad","iraq_mosul","jordan_amman","lebanon_bekaa","syria_aleppo","yemen_sanaa","iran_isfahan","iran_shiraz","turkey_konya","turkey_sanliurfa","israel_beersheba","palestine_jenin","egypt_faiyum","egypt_aswan","morocco_marrakesh","morocco_fez","algeria_tlemcen","tunisia_kairouan","libya_sabha","sudan_khartoum","ethiopia_addis_ababa","kenya_nakuru","uganda_kampala","nigeria_kano","ghana_kumasi","senegal_thies","zambia_lusaka","zimbabwe_bulawayo","south_africa_pretoria","madagascar_antananarivo","india_delhi","india_nagpur","india_hyderabad","pakistan_lahore","pakistan_multan","bangladesh_rajshahi","nepal_kathmandu","china_beijing","china_chengdu","japan_sapporo","south_korea_daejeon","thailand_chiang_mai","vietnam_hanoi","indonesia_yogyakarta","philippines_davao","kazakhstan_astana","uzbekistan_samarkand","uk_cambridge","france_toulouse","germany_hanover","netherlands_wageningen","italy_bologna","spain_zaragoza","portugal_evora","greece_larissa","poland_lublin","romania_cluj","us_nebraska_lincoln","us_california_fresno","us_iowa_ames","us_arizona_tucson","us_georgia_athens","canada_saskatoon","canada_guelph","mexico_guanajuato","mexico_hermosillo","colombia_bogota","peru_cusco","brazil_campinas","brazil_cuiaba","chile_talca","argentina_rosario","uruguay_durazno","bolivia_cochabamba","australia_melbourne","australia_perth","australia_toowoomba","australia_wagga_wagga","new_zealand_hamilton","new_zealand_christchurch"];
const allSites = [...originalSites, ...additionalSites];
assert.equal(allSites.length, 97);
assert.equal(new Set(allSites).size, 97);

let originalEvents = 0;
let originalFirst = 0;
let additionalEvents = 0;
let additionalFirst = 0;

for (const siteId of allSites) {
  const file = new URL(`../public/site-results/${siteId}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(data.source.mode, "verified_prefetched_nasa", siteId);
  assert.equal(data.source.site, siteId, siteId);
  assert.match(data.source.sha256, /^[0-9a-f]{64}$/, siteId);
  assert.equal(data.source.chunks.length, 5, siteId);
  assert.equal(data.period.start, "1981-01-01", siteId);
  assert.equal(data.period.end, "2025-12-31", siteId);
  assert.equal(data.period.days, 16436, siteId);
  assert.equal(data.monthly.length, 540, siteId);
  assert.equal(data.quality.paired_day_coverage, 1, siteId);
  assert.equal(data.ready_for_scientific_claims, false, siteId);
  const count = data.events.length;
  const first = data.events.filter(event => event.status === "COMPLETE_SURFACE_FIRST").length;
  if (originalSites.includes(siteId)) {
    originalEvents += count;
    originalFirst += first;
  } else {
    additionalEvents += count;
    additionalFirst += first;
  }
}

assert.equal(originalEvents, 158);
assert.equal(originalFirst, 73);
assert.equal(additionalEvents, 1972);
assert.equal(additionalFirst, 770);
console.log("Verified 97 NASA site snapshots: 6 original research sites unchanged, 91 additional historical analyses, 1,594,292 site-days.");

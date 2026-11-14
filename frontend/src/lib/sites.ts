export type SiteId = "us_sgp_goodwell" | "us_sgp_stillwater" | "australia_narrabri" | "spain_cordoba" | "argentina_pampas" | "southern_africa" | "qatar_doha" | "qatar_dukhān" | "saudi_riyadh" | "saudi_jeddah" | "saudi_hail" | "uae_abu_dhabi" | "uae_al_ain" | "oman_muscat" | "oman_nizwa" | "kuwait_al_jahra" | "bahrain_riffa" | "iraq_baghdad" | "iraq_mosul" | "jordan_amman" | "lebanon_bekaa" | "syria_aleppo" | "yemen_sanaa" | "iran_isfahan" | "iran_shiraz" | "turkey_konya" | "turkey_sanliurfa" | "israel_beersheba" | "palestine_jenin" | "egypt_faiyum" | "egypt_aswan" | "morocco_marrakesh" | "morocco_fez" | "algeria_tlemcen" | "tunisia_kairouan" | "libya_sabha" | "sudan_khartoum" | "ethiopia_addis_ababa" | "kenya_nakuru" | "uganda_kampala" | "nigeria_kano" | "ghana_kumasi" | "senegal_thies" | "zambia_lusaka" | "zimbabwe_bulawayo" | "south_africa_pretoria" | "madagascar_antananarivo" | "india_delhi" | "india_nagpur" | "india_hyderabad" | "pakistan_lahore" | "pakistan_multan" | "bangladesh_rajshahi" | "nepal_kathmandu" | "china_beijing" | "china_chengdu" | "japan_sapporo" | "south_korea_daejeon" | "thailand_chiang_mai" | "vietnam_hanoi" | "indonesia_yogyakarta" | "philippines_davao" | "kazakhstan_astana" | "uzbekistan_samarkand" | "uk_cambridge" | "france_toulouse" | "germany_hanover" | "netherlands_wageningen" | "italy_bologna" | "spain_zaragoza" | "portugal_evora" | "greece_larissa" | "poland_lublin" | "romania_cluj" | "us_nebraska_lincoln" | "us_california_fresno" | "us_iowa_ames" | "us_arizona_tucson" | "us_georgia_athens" | "canada_saskatoon" | "canada_guelph" | "mexico_guanajuato" | "mexico_hermosillo" | "colombia_bogota" | "peru_cusco" | "brazil_campinas" | "brazil_cuiaba" | "chile_talca" | "argentina_rosario" | "uruguay_durazno" | "bolivia_cochabamba" | "australia_melbourne" | "australia_perth" | "australia_toowoomba" | "australia_wagga_wagga" | "new_zealand_hamilton" | "new_zealand_christchurch";

export type Site = {
  id: SiteId;
  name: string;
  region: string;
  country: string;
  coordinates: [number, number];
  landscape: string;
  index: string;
};

export const sites: Site[] = [
  { id: "us_sgp_goodwell", name: "Goodwell", region: "Oklahoma", country: "United States", coordinates: [-101.618, 36.597], landscape: "Southern High Plains", index: "01" },
  { id: "us_sgp_stillwater", name: "Stillwater", region: "Oklahoma", country: "United States", coordinates: [-97.091, 36.118], landscape: "Central Great Plains", index: "02" },
  { id: "australia_narrabri", name: "Narrabri", region: "New South Wales", country: "Australia", coordinates: [149.783, -30.325], landscape: "Northern wheatbelt", index: "03" },
  { id: "spain_cordoba", name: "Córdoba", region: "Andalusia", country: "Spain", coordinates: [-4.779, 37.888], landscape: "Mediterranean cropland", index: "04" },
  { id: "argentina_pampas", name: "Argentine Pampas", region: "Pampas", country: "Argentina", coordinates: [-61.0, -35.0], landscape: "Temperate cropland", index: "05" },
  { id: "southern_africa", name: "Southern Africa", region: "Interior South Africa", country: "South Africa", coordinates: [25.0, -27.0], landscape: "Semi-arid grassland", index: "06" },
  { id: "qatar_doha", name: "Doha", region: "Middle East", country: "Qatar", coordinates: [51.531, 25.2854], landscape: "Middle East gridded model point", index: "07" },
  { id: "qatar_dukhān", name: "Dukhan", region: "Middle East", country: "Qatar", coordinates: [50.78, 25.43], landscape: "Middle East gridded model point", index: "08" },
  { id: "saudi_riyadh", name: "Riyadh", region: "Middle East", country: "Saudi Arabia", coordinates: [46.6753, 24.7136], landscape: "Middle East gridded model point", index: "09" },
  { id: "saudi_jeddah", name: "Jeddah", region: "Middle East", country: "Saudi Arabia", coordinates: [39.1728, 21.5433], landscape: "Middle East gridded model point", index: "10" },
  { id: "saudi_hail", name: "Ha'il", region: "Middle East", country: "Saudi Arabia", coordinates: [41.7, 27.52], landscape: "Middle East gridded model point", index: "11" },
  { id: "uae_abu_dhabi", name: "Abu Dhabi", region: "Middle East", country: "United Arab Emirates", coordinates: [54.3773, 24.4539], landscape: "Middle East gridded model point", index: "12" },
  { id: "uae_al_ain", name: "Al Ain", region: "Middle East", country: "United Arab Emirates", coordinates: [55.75, 24.2], landscape: "Middle East gridded model point", index: "13" },
  { id: "oman_muscat", name: "Muscat", region: "Middle East", country: "Oman", coordinates: [58.3829, 23.588], landscape: "Middle East gridded model point", index: "14" },
  { id: "oman_nizwa", name: "Nizwa", region: "Middle East", country: "Oman", coordinates: [57.53, 22.93], landscape: "Middle East gridded model point", index: "15" },
  { id: "kuwait_al_jahra", name: "Al Jahra", region: "Middle East", country: "Kuwait", coordinates: [47.68, 29.35], landscape: "Middle East gridded model point", index: "16" },
  { id: "bahrain_riffa", name: "Riffa", region: "Middle East", country: "Bahrain", coordinates: [50.56, 26.13], landscape: "Middle East gridded model point", index: "17" },
  { id: "iraq_baghdad", name: "Baghdad", region: "Middle East", country: "Iraq", coordinates: [44.3661, 33.3152], landscape: "Middle East gridded model point", index: "18" },
  { id: "iraq_mosul", name: "Mosul", region: "Middle East", country: "Iraq", coordinates: [43.13, 36.34], landscape: "Middle East gridded model point", index: "19" },
  { id: "jordan_amman", name: "Amman", region: "Middle East", country: "Jordan", coordinates: [35.9106, 31.9539], landscape: "Middle East gridded model point", index: "20" },
  { id: "lebanon_bekaa", name: "Bekaa Valley", region: "Middle East", country: "Lebanon", coordinates: [36.03, 33.85], landscape: "Middle East gridded model point", index: "21" },
  { id: "syria_aleppo", name: "Aleppo", region: "Middle East", country: "Syria", coordinates: [37.16, 36.2], landscape: "Middle East gridded model point", index: "22" },
  { id: "yemen_sanaa", name: "Sana'a", region: "Middle East", country: "Yemen", coordinates: [44.191, 15.3694], landscape: "Middle East gridded model point", index: "23" },
  { id: "iran_isfahan", name: "Isfahan", region: "Middle East", country: "Iran", coordinates: [51.668, 32.6546], landscape: "Middle East gridded model point", index: "24" },
  { id: "iran_shiraz", name: "Shiraz", region: "Middle East", country: "Iran", coordinates: [52.58, 29.59], landscape: "Middle East gridded model point", index: "25" },
  { id: "turkey_konya", name: "Konya", region: "Middle East", country: "Türkiye", coordinates: [32.49, 37.87], landscape: "Middle East gridded model point", index: "26" },
  { id: "turkey_sanliurfa", name: "Sanliurfa", region: "Middle East", country: "Türkiye", coordinates: [38.79, 37.16], landscape: "Middle East gridded model point", index: "27" },
  { id: "israel_beersheba", name: "Beersheba", region: "Middle East", country: "Israel", coordinates: [34.79, 31.25], landscape: "Middle East gridded model point", index: "28" },
  { id: "palestine_jenin", name: "Jenin", region: "Middle East", country: "Palestine", coordinates: [35.3, 32.46], landscape: "Middle East gridded model point", index: "29" },
  { id: "egypt_faiyum", name: "Faiyum", region: "Middle East", country: "Egypt", coordinates: [30.84, 29.31], landscape: "Middle East gridded model point", index: "30" },
  { id: "egypt_aswan", name: "Aswan", region: "Middle East", country: "Egypt", coordinates: [32.9, 24.09], landscape: "Middle East gridded model point", index: "31" },
  { id: "morocco_marrakesh", name: "Marrakesh", region: "North Africa", country: "Morocco", coordinates: [-8, 31.63], landscape: "North Africa gridded model point", index: "32" },
  { id: "morocco_fez", name: "Fez", region: "North Africa", country: "Morocco", coordinates: [-4.99, 34.06], landscape: "North Africa gridded model point", index: "33" },
  { id: "algeria_tlemcen", name: "Tlemcen", region: "North Africa", country: "Algeria", coordinates: [-1.32, 34.88], landscape: "North Africa gridded model point", index: "34" },
  { id: "tunisia_kairouan", name: "Kairouan", region: "North Africa", country: "Tunisia", coordinates: [10.1, 35.68], landscape: "North Africa gridded model point", index: "35" },
  { id: "libya_sabha", name: "Sabha", region: "North Africa", country: "Libya", coordinates: [14.43, 27.04], landscape: "North Africa gridded model point", index: "36" },
  { id: "sudan_khartoum", name: "Khartoum", region: "North Africa", country: "Sudan", coordinates: [32.56, 15.5], landscape: "North Africa gridded model point", index: "37" },
  { id: "ethiopia_addis_ababa", name: "Addis Ababa", region: "Sub-Saharan Africa", country: "Ethiopia", coordinates: [38.76, 9], landscape: "Sub-Saharan Africa gridded model point", index: "38" },
  { id: "kenya_nakuru", name: "Nakuru", region: "Sub-Saharan Africa", country: "Kenya", coordinates: [36.07, -0.3], landscape: "Sub-Saharan Africa gridded model point", index: "39" },
  { id: "uganda_kampala", name: "Kampala", region: "Sub-Saharan Africa", country: "Uganda", coordinates: [32.58, 0.35], landscape: "Sub-Saharan Africa gridded model point", index: "40" },
  { id: "nigeria_kano", name: "Kano", region: "Sub-Saharan Africa", country: "Nigeria", coordinates: [8.52, 12], landscape: "Sub-Saharan Africa gridded model point", index: "41" },
  { id: "ghana_kumasi", name: "Kumasi", region: "Sub-Saharan Africa", country: "Ghana", coordinates: [-1.62, 6.69], landscape: "Sub-Saharan Africa gridded model point", index: "42" },
  { id: "senegal_thies", name: "Thiès", region: "Sub-Saharan Africa", country: "Senegal", coordinates: [-16.93, 14.79], landscape: "Sub-Saharan Africa gridded model point", index: "43" },
  { id: "zambia_lusaka", name: "Lusaka", region: "Sub-Saharan Africa", country: "Zambia", coordinates: [28.28, -15.42], landscape: "Sub-Saharan Africa gridded model point", index: "44" },
  { id: "zimbabwe_bulawayo", name: "Bulawayo", region: "Sub-Saharan Africa", country: "Zimbabwe", coordinates: [28.58, -20.16], landscape: "Sub-Saharan Africa gridded model point", index: "45" },
  { id: "south_africa_pretoria", name: "Pretoria", region: "Sub-Saharan Africa", country: "South Africa", coordinates: [28.23, -25.747], landscape: "Sub-Saharan Africa gridded model point", index: "46" },
  { id: "madagascar_antananarivo", name: "Antananarivo", region: "Sub-Saharan Africa", country: "Madagascar", coordinates: [47.51, -18.88], landscape: "Sub-Saharan Africa gridded model point", index: "47" },
  { id: "india_delhi", name: "Delhi", region: "South and East Asia", country: "India", coordinates: [77.209, 28.6139], landscape: "South and East Asia gridded model point", index: "48" },
  { id: "india_nagpur", name: "Nagpur", region: "South and East Asia", country: "India", coordinates: [79.0882, 21.1458], landscape: "South and East Asia gridded model point", index: "49" },
  { id: "india_hyderabad", name: "Hyderabad", region: "South and East Asia", country: "India", coordinates: [78.4867, 17.385], landscape: "South and East Asia gridded model point", index: "50" },
  { id: "pakistan_lahore", name: "Lahore", region: "South and East Asia", country: "Pakistan", coordinates: [74.36, 31.52], landscape: "South and East Asia gridded model point", index: "51" },
  { id: "pakistan_multan", name: "Multan", region: "South and East Asia", country: "Pakistan", coordinates: [71.52, 30.16], landscape: "South and East Asia gridded model point", index: "52" },
  { id: "bangladesh_rajshahi", name: "Rajshahi", region: "South and East Asia", country: "Bangladesh", coordinates: [88.6, 24.37], landscape: "South and East Asia gridded model point", index: "53" },
  { id: "nepal_kathmandu", name: "Kathmandu", region: "South and East Asia", country: "Nepal", coordinates: [85.32, 27.71], landscape: "South and East Asia gridded model point", index: "54" },
  { id: "china_beijing", name: "Beijing", region: "South and East Asia", country: "China", coordinates: [116.4, 39.9], landscape: "South and East Asia gridded model point", index: "55" },
  { id: "china_chengdu", name: "Chengdu", region: "South and East Asia", country: "China", coordinates: [104.07, 30.57], landscape: "South and East Asia gridded model point", index: "56" },
  { id: "japan_sapporo", name: "Sapporo", region: "South and East Asia", country: "Japan", coordinates: [141.35, 43.06], landscape: "South and East Asia gridded model point", index: "57" },
  { id: "south_korea_daejeon", name: "Daejeon", region: "South and East Asia", country: "South Korea", coordinates: [127.38, 36.35], landscape: "South and East Asia gridded model point", index: "58" },
  { id: "thailand_chiang_mai", name: "Chiang Mai", region: "South and East Asia", country: "Thailand", coordinates: [98.98, 18.78], landscape: "South and East Asia gridded model point", index: "59" },
  { id: "vietnam_hanoi", name: "Hanoi", region: "South and East Asia", country: "Vietnam", coordinates: [105.85, 21.03], landscape: "South and East Asia gridded model point", index: "60" },
  { id: "indonesia_yogyakarta", name: "Yogyakarta", region: "South and East Asia", country: "Indonesia", coordinates: [110.37, -7.8], landscape: "South and East Asia gridded model point", index: "61" },
  { id: "philippines_davao", name: "Davao", region: "South and East Asia", country: "Philippines", coordinates: [125.61, 7.07], landscape: "South and East Asia gridded model point", index: "62" },
  { id: "kazakhstan_astana", name: "Astana", region: "Central Asia", country: "Kazakhstan", coordinates: [71.43, 51.17], landscape: "Central Asia gridded model point", index: "63" },
  { id: "uzbekistan_samarkand", name: "Samarkand", region: "Central Asia", country: "Uzbekistan", coordinates: [66.96, 39.65], landscape: "Central Asia gridded model point", index: "64" },
  { id: "uk_cambridge", name: "Cambridge", region: "Europe", country: "United Kingdom", coordinates: [0.12, 52.2], landscape: "Europe gridded model point", index: "65" },
  { id: "france_toulouse", name: "Toulouse", region: "Europe", country: "France", coordinates: [1.44, 43.6], landscape: "Europe gridded model point", index: "66" },
  { id: "germany_hanover", name: "Hanover", region: "Europe", country: "Germany", coordinates: [9.73, 52.38], landscape: "Europe gridded model point", index: "67" },
  { id: "netherlands_wageningen", name: "Wageningen", region: "Europe", country: "Netherlands", coordinates: [5.67, 51.97], landscape: "Europe gridded model point", index: "68" },
  { id: "italy_bologna", name: "Bologna", region: "Europe", country: "Italy", coordinates: [11.34, 44.49], landscape: "Europe gridded model point", index: "69" },
  { id: "spain_zaragoza", name: "Zaragoza", region: "Europe", country: "Spain", coordinates: [-0.88, 41.65], landscape: "Europe gridded model point", index: "70" },
  { id: "portugal_evora", name: "Évora", region: "Europe", country: "Portugal", coordinates: [-7.91, 38.57], landscape: "Europe gridded model point", index: "71" },
  { id: "greece_larissa", name: "Larissa", region: "Europe", country: "Greece", coordinates: [22.42, 39.64], landscape: "Europe gridded model point", index: "72" },
  { id: "poland_lublin", name: "Lublin", region: "Europe", country: "Poland", coordinates: [22.57, 51.25], landscape: "Europe gridded model point", index: "73" },
  { id: "romania_cluj", name: "Cluj-Napoca", region: "Europe", country: "Romania", coordinates: [23.6, 46.77], landscape: "Europe gridded model point", index: "74" },
  { id: "us_nebraska_lincoln", name: "Lincoln", region: "North America", country: "United States", coordinates: [-96.7, 40.81], landscape: "North America gridded model point", index: "75" },
  { id: "us_california_fresno", name: "Fresno", region: "North America", country: "United States", coordinates: [-119.79, 36.74], landscape: "North America gridded model point", index: "76" },
  { id: "us_iowa_ames", name: "Ames", region: "North America", country: "United States", coordinates: [-93.62, 42.03], landscape: "North America gridded model point", index: "77" },
  { id: "us_arizona_tucson", name: "Tucson", region: "North America", country: "United States", coordinates: [-110.97, 32.22], landscape: "North America gridded model point", index: "78" },
  { id: "us_georgia_athens", name: "Athens, Georgia", region: "North America", country: "United States", coordinates: [-83.38, 33.95], landscape: "North America gridded model point", index: "79" },
  { id: "canada_saskatoon", name: "Saskatoon", region: "North America", country: "Canada", coordinates: [-106.67, 52.13], landscape: "North America gridded model point", index: "80" },
  { id: "canada_guelph", name: "Guelph", region: "North America", country: "Canada", coordinates: [-80.25, 43.54], landscape: "North America gridded model point", index: "81" },
  { id: "mexico_guanajuato", name: "Guanajuato", region: "North America", country: "Mexico", coordinates: [-101.26, 21.02], landscape: "North America gridded model point", index: "82" },
  { id: "mexico_hermosillo", name: "Hermosillo", region: "North America", country: "Mexico", coordinates: [-110.96, 29.07], landscape: "North America gridded model point", index: "83" },
  { id: "colombia_bogota", name: "Bogotá", region: "South America", country: "Colombia", coordinates: [-74.07, 4.71], landscape: "South America gridded model point", index: "84" },
  { id: "peru_cusco", name: "Cusco", region: "South America", country: "Peru", coordinates: [-71.97, -13.53], landscape: "South America gridded model point", index: "85" },
  { id: "brazil_campinas", name: "Campinas", region: "South America", country: "Brazil", coordinates: [-47.06, -22.9], landscape: "South America gridded model point", index: "86" },
  { id: "brazil_cuiaba", name: "Cuiabá", region: "South America", country: "Brazil", coordinates: [-56.1, -15.6], landscape: "South America gridded model point", index: "87" },
  { id: "chile_talca", name: "Talca", region: "South America", country: "Chile", coordinates: [-71.66, -35.43], landscape: "South America gridded model point", index: "88" },
  { id: "argentina_rosario", name: "Rosario", region: "South America", country: "Argentina", coordinates: [-60.66, -32.95], landscape: "South America gridded model point", index: "89" },
  { id: "uruguay_durazno", name: "Durazno", region: "South America", country: "Uruguay", coordinates: [-56.52, -33.38], landscape: "South America gridded model point", index: "90" },
  { id: "bolivia_cochabamba", name: "Cochabamba", region: "South America", country: "Bolivia", coordinates: [-66.16, -17.39], landscape: "South America gridded model point", index: "91" },
  { id: "australia_melbourne", name: "Melbourne", region: "Oceania", country: "Australia", coordinates: [144.96, -37.81], landscape: "Oceania gridded model point", index: "92" },
  { id: "australia_perth", name: "Perth", region: "Oceania", country: "Australia", coordinates: [115.86, -31.95], landscape: "Oceania gridded model point", index: "93" },
  { id: "australia_toowoomba", name: "Toowoomba", region: "Oceania", country: "Australia", coordinates: [151.95, -27.56], landscape: "Oceania gridded model point", index: "94" },
  { id: "australia_wagga_wagga", name: "Wagga Wagga", region: "Oceania", country: "Australia", coordinates: [147.37, -35.11], landscape: "Oceania gridded model point", index: "95" },
  { id: "new_zealand_hamilton", name: "Hamilton", region: "Oceania", country: "New Zealand", coordinates: [175.28, -37.79], landscape: "Oceania gridded model point", index: "96" },
  { id: "new_zealand_christchurch", name: "Christchurch", region: "Oceania", country: "New Zealand", coordinates: [172.63, -43.53], landscape: "Oceania gridded model point", index: "97" }
];

export const researchSites = sites.slice(0, 6);
export const productSites = sites.slice(6);
export const siteRegions = Array.from(new Set(productSites.map(site => site.region)));

export function isCoreSite(id: SiteId): boolean {
  return researchSites.some(site => site.id === id);
}

export function findSite(id: string): Site {
  return sites.find(site => site.id === id) ?? sites[0];
}

export function siteCoordinates(site: Site): string {
  const [longitude, latitude] = site.coordinates;
  return `${Math.abs(latitude).toFixed(3)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(3)}°${longitude >= 0 ? "E" : "W"}`;
}

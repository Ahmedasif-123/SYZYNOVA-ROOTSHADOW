export type SiteId = "us_sgp_goodwell" | "us_sgp_stillwater" | "australia_narrabri" | "spain_cordoba" | "argentina_pampas" | "southern_africa";

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
  { id: "southern_africa", name: "Southern Africa", region: "Interior South Africa", country: "South Africa", coordinates: [25.0, -27.0], landscape: "Semi-arid grassland", index: "06" }
];

export function findSite(id: string): Site {
  return sites.find(site => site.id === id) ?? sites[0];
}

export function siteCoordinates(site: Site): string {
  const [longitude, latitude] = site.coordinates;
  return `${Math.abs(latitude).toFixed(3)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(3)}°${longitude >= 0 ? "E" : "W"}`;
}

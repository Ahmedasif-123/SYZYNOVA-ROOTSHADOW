# ROOTSHADOW — Design references, asset provenance, and implementation notes

## Design direction

ROOTSHADOW combines an accessible agricultural explanation with an advanced scientific workbench. The interface uses a genuine globe as navigation, a historical monthly depth lens as a teaching instrument, and reproducible data visualizations in the investigation screen.

External applications and public repositories were researched as references for interaction patterns. Their code and artwork were not copied into the ROOTSHADOW interface.

| Reference | URL | Pattern examined |
| --- | --- | --- |
| NASA Worldview | https://github.com/nasa-gibs/worldview | Time navigation, geographic search and scientific layer organization |
| Copernicus Browser | https://github.com/eu-cdse/copernicus-browser | Central geography with compact side tools, comparisons and imagery provenance |
| react-globe.gl / Three Globe | https://github.com/vasturiano/react-globe.gl and https://github.com/vasturiano/three-globe | 3D geographic navigation, labels, sensor markers and distinct map layers |
| MapLibre GL JS | https://github.com/maplibre/maplibre-gl-js | Interactive flat-map projection and GeoJSON loading |
| deck.gl | https://github.com/visgl/deck.gl | GPU-accelerated geographic data visualization conventions |
| Earth View | https://github.com/colincode0/earth-view | Seamless transition from globe to regional research workspace |

These are engineering and product references, not claims of collaboration, endorsement or copied interfaces.

## Earth texture

- Local asset: `frontend/public/earth-day-2048.jpg`
- Original scientific media: NASA Goddard Space Flight Center, Blue Marble cloud-free land/ocean/ice composite.
- Source: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg
- Credit: NASA Goddard Space Flight Center; Blue Marble image by Reto Stöckli, enhanced by Robert Simmon.
- File origin: verified same-media asset distributed as `public/assets/earth-day-2048.jpg` in https://github.com/Depal-Jakub/orbital-bloom and traced to its `DATA_SOURCES.md`.
- Role: static geographic basemap on the 3D globe. The image has **no** date-specific soil moisture meaning and is not a forecast or real-time satellite feed.
- NASA imagery is used in an educational and informational context, with no NASA endorsement claimed. NASA branding and logos are not reproduced.

## World map fallback

- Local assets: `frontend/public/world.geojson`, `frontend/public/world-map.svg`.
- Source geometry: public world boundary GeoJSON available from https://github.com/holtzy/D3-graph-gallery/blob/master/DATA/world.geojson.
- Coordinates are geometrically simplified/rounded in the local GeoJSON; the static SVG is generated from that geometry.
- Purpose: global context and selectable study sites. Coordinates denote points in a gridded reanalysis dataset, not physical field boundaries or land parcels.
- 3D rendering (Three.js) and 2D rendering (MapLibre) use locally hosted assets. No commercial map token or third-party basemap request is required.

## Scientific safeguards

- The 1981–2025 timeline represents historical NASA POWER/MERRA-2 model-derived wetness for four specific points only.
- Surface/root-zone percentiles displayed in the depth lens are monthly medians. Drought recovery rules operate on daily data, so monthly bar crossings are **not** labeled as recovery-event dates.
- Drought detection, recovery delays, sensitivity checks and audit verdicts originate from the existing Python service and remain unchanged by the visual redesign.
- Null model, reanalysis model circularity and independent corroboration limitations must remain visible. ROOTSHADOW is not a validated agricultural decision-support system.
- Offline or missing data states must report limitations and may not substitute synthetic evidence for verified results.

## Release checklist

1. Build TypeScript and Vite without errors.
2. Pass backend test suite and browser interaction suite for desktop/mobile.
3. Verify all four `/api/analyze?mode=site` responses in Vercel.
4. Validate the 3D globe on a WebGL-capable device and flat-map fallback without WebGL.
5. Validate historical timeline scrubbing, site selection, scientific comparisons and evidence JSON export.
6. Review actual browser screenshots and mobile viewport.
7. Keep `main` protected and separate until review; publish only a verified preview candidate.

Related scientific citations: `docs/ATTRIBUTION_AND_AI.md` and `docs/EXPLORATORY_4_SITE_RESULTS.md`.

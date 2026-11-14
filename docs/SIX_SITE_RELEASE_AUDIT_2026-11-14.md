# ROOTSHADOW | Six-site release audit
**Date:** 14 November 2026
**Source branch:** `farm-decision-clarity-six-sites`
**Release target:** `gh-pages` (GitHub Pages source must be configured in repository settings)
**Scope:** Repository, workflow, built-assets, static JSON, and Vercel deployment metadata. This does not constitute a browser visit to the public website.

## Verified code and build state
- The six-location branch is separate from `main`. The default `main` still contains the earlier four-location application.
- GitHub Actions **Frontend build** run [43629472760](https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/actions/runs/43629472760) passed; workflow includes TypeScript build and Playwright browser tests.
- GitHub Actions **Tests** run [43629472730](https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/actions/runs/43629472730) passed.
- GitHub Actions **Publish ROOTSHADOW static fallback** run [43629467386](https://github.com/Ahmedasif-123/SYZYNOVA-ROOTSHADOW/actions/runs/43629467386) passed.
- The `gh-pages` branch contains `index.html`, bundled map and globe assets, JavaScript and CSS bundles, and all six `site-results/*.json` files. The generated CSS uses the project-relative world-map URL.
- GitHub Pages activation and a successful HTTP/browser load at the public URL remain **unverified** in this audit. GitHub Actions publication does not itself prove public serving.

## Published research-data check
| Site | Drought episodes | Surface-first completed | Median positive delay |
| --- | ---: | ---: | ---: |
| Goodwell, United States | 31 | 19 | 2 days |
| Stillwater, United States | 26 | 6 | 1 day |
| Narrabri, Australia | 28 | 16 | 1 day |
| Córdoba, Spain | 25 | 6 | 1 day |
| Argentine Pampas, Argentina | 27 | 11 | 2 days |
| Interior South Africa | 21 | 15 | 25 days |
| **Total** | **158** | **73** | **Not pooled** |

All six JSON outputs report 16,436 historical days, 540 monthly summaries, and `ready_for_scientific_claims=false`. They contain NASA POWER source URLs, retrieval dates, local SHA-256 provenance, and event-level results. SHA matching is not independent authentication of NASA nor field validation.

**Specific caution:** The 25-day South Africa median is threshold-sensitive; an alternate recovery cutoff produces a 3.5-day median. Goodwell's nominal event-level p≈0.01894 does not pass a six-site Bonferroni threshold of 0.05/6≈0.00833. The sample cannot establish a global effect.

## Deployment separation
- Vercel reports an API preview at `rootshadow-api-preview-euaembw1t.vercel.app` in the READY state, but READY alone is not an end-to-end functional verification.
- The most recently observed READY frontend preview was associated with commit `31b8a8a`, older than the final six-site interface source. Do not share that preview as the latest interface.
- The GitHub Pages build is a static snapshot bundle. Its six study results do not require an API or cloud billing. The published browser URL needs independent verification after enabling Pages.

## Remaining release blockers
1. GitHub repository Settings → Pages: select **Deploy from a branch**, branch **gh-pages**, folder **/(root)**, and save.
2. Open the public site in a new/private browser. Select all six locations; switch world map/3D globe; open chart, event filter, conclusion, exports, and mobile view.
3. Confirm there are no 404s for CSS, JavaScript, textures, SVG, GeoJSON or any of the six `site-results` JSON files.
4. Use the static Pages URL for a current six-site demonstration unless a newer Vercel frontend deployment has been independently verified.
5. Do not claim independent in-situ/SMAP/GLDAS scientific validation, globally representative inference, operational drought forecasting, or a finished OpenAI assistant.

No changes to the scientifically derived datasets were made by this documentation-and-metadata correction.

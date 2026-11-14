# Attribution and AI-assisted development

## NASA data and technical references

- NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- NASA POWER Hydrology parameters: https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/
- NASA SMAP Level-4 data catalog (conditional; not yet ingested): https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008
- NASA GLDAS Noah product (conditional; not yet ingested): https://developers.google.com/earth-engine/datasets/catalog/NASA_GLDAS_V021_NOAH_G025_T3H
- NASA Space Apps 2026 challenge website: https://www.spaceappschallenge.org/2026/

The application code uses Python, FastAPI, NumPy, Pandas, SciPy, Requests, Uvicorn and test tooling as declared in `api/requirements.txt`. The public deployment workflow (not enabled until configured) uses Azure Static Web Apps and Azure Functions. Data sources not actually used in the final submission must not be represented as used. Include the required formal NASA POWER dataset citation in the final Space Apps submission.

## AI assistance and responsibilities

The two human competitors are Muhammad Ahmed and Somaya Bakir of SYZYNOVA. ChatGPT (OpenAI), Claude (Anthropic), and Gemini (Google) were consulted for code generation, debugging, scientific-method critique, and review. Their suggestions have been independently checked, modified, and tested where possible; tool-produced code and text should be disclosed in the official submission. AI models are not human team members, validated data sources, or authorities on scientific significance.

## Competition timing and research status

Team should accurately disclose any reuse of code or prototypes developed before official hackathon hours, and follow current organizer eligibility rules. The provided archive contains no verified live NASA case. All synthetic demonstrations must remain clearly identified.

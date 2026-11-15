# ROOTSHADOW Evidence AI: secure, source-grounded interpretation

The **Evidence AI** assistant is a server-only OpenAI Responses API integration. It is not a trained weather, soil-water, or agricultural forecasting model. The core validated scientific methods and NASA data are separate. The service does not run in the browser, and neither the OpenAI key nor demo access code is included in frontend assets or GitHub.

## Setup

Create a dedicated OpenAI API project for this one-day NASA demo. Open the project **Limits** settings, set a **$28 monthly spend limit**, turn on **Enforce a hard limit**, and set a spend alert before the limit. OpenAI hard-limit enforcement can lag slightly, so spend may exceed the configured amount. You can also set lower model request/token limits. The frontend does not implement a globally durable cost counter; serverless-memory throttling is only a secondary layer.

In Vercel Project Settings → Environment Variables add for **Production**:
- \`OPENAI_API_KEY\`: your private OpenAI API key from that dedicated project.
- \`ROOTSHADOW_AI_ACCESS_CODE\`: a unique, high-entropy temporary code of your choice, shared only with demo presenters.

Do not paste either secret into GitHub issues, frontend \`VITE_*\` values, source files, chat messages or the website public metadata.

After saving environment variables, redeploy the production app so the serverless function loads them. The interface should report that AI is unavailable if the secrets have not been configured. **Never publish an unprotected OpenAI proxy.**

## Model and safeguards

The default model is \`gpt-6-astra\`, with medium reasoning. Standard pricing at setup is $10 per million input and $50 per million output tokens. Each request is bounded to 700 question characters, one trusted site id, an access code, a 2,400-token maximum output including internal reasoning, and server-side source retrieval. The browser cannot replace the NASA or NOAA evidence bundle with arbitrary invented data.

The model receives only:
- The site-specific verified 1981–2025 NASA analysis snapshot,
- A date-labelled recent NASA POWER/MERRA-2 point if available,
- The separate independent four-station NOAA probe pilot for Goodwell/Stillwater ONLY.

The service uses strict JSON-schema responses and checks citations against available evidence IDs. It rejects incomplete or malformed answers. A deterministic guard refuses future predictions and irrigation prescriptions. This is a *reliability control, not a guarantee that language generation can never hallucinate.* Site-specific numbers remain independently visible in the Decision Desk.

No API provider response storage is requested (\`store:false\`). The requested daily question limit is per warm serverless instance only; OpenAI's own project-enforced spend limit is the primary spending safeguard.

## Scientific claims

The NOAA pilot currently found low mismatch-detection recall (approximately 6.7–10.5% across four Oklahoma stations). Do not claim that the NASA mismatch flag is field-verified at all 97 points. Model-only moisture or historical rank predictions should not be presented as independently validated future crop conditions.

## Basic API test

\`GET /api/ask\` returns configuration status without exposing a secret.

\`POST /api/ask\` accepts a JSON body \`{"siteId":"us_sgp_goodwell","perspective":"scientist","question":"How reliable was the mismatch screen compared with NOAA probes?","accessCode":"<presenter-secret>"}\`. Missing credentials result in HTTP 503 and incorrect codes in HTTP 401. Unsupported future forecasts return an evidence-based refusal without calling a paid model. If the key is configured and the demo code is accepted, the server calls OpenAI, validates evidence citations, and returns the structured answer.

The app must be tested on desktop and mobile, both with and without credentials, before judges use it.

# ROOTSHADOW product data expansion

This directory is separate from the six research-site datasets and does not modify the research UI, code, results, `main` branch, or Vercel production website.

The catalog in `locations.json` defines 91 additional geographic points across nine regions, including 25 Middle East locations. A GitHub Actions workflow attempts to acquire NASA POWER daily GWETTOP, GWETROOT, PRECTOTCORR and T2M (1981–2025). Each successful acquisition preserves five original NASA response chunks, their URLs and SHA-256 digests, the compressed original-response archive, a compressed processed CSV, and a manifest.

Only locations present in `gate0/manifests/` and marked verified in `ACQUISITION_REPORT.json` should be counted as downloaded. All new records are gridded MERRA-2 model estimates; no independent scientific validation or new analysis is claimed. This dataset is not connected to the existing six-site research interface.

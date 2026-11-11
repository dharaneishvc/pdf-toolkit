# PDF Toolkit Verification

Verified locally on Windows with Node.js 24 on 2026-11-01. This report applies only to this repository.

| Check | Result |
| --- | --- |
| Supported catalog | 26 tools |
| Unit tests | 47 passed |
| Desktop/mobile browser cases | 18 passed |
| Locked dependency install | `npm ci` passed |
| Source lint | Passed with one advisory warning |
| TypeScript and production build | Passed |
| Dependency audit | Zero reported vulnerabilities at verification time |
| Editor diagnostics | No errors |

## Verified Coverage

- Generated PDF/form fixtures, page ranges, merge/order/repetition, extraction/deletion/duplication, selected rotation, resize/crop/blank insertion, metadata, composition, forms, splitting, and invalid inputs.
- Painted PDF.js previews, actual merge/split downloads, text extraction, PNG page exports, form fill/flatten, exact attachment-content roundtrips, PNG-to-PDF/image overlays, and result reuse.
- Offscreen print-intent rendering passed an additional three repeated runs per viewport during regression repair.
- All tool navigation, corrupt-input rejection, invalid ranges, source retention after failed imports, and reader/writer compatibility for tested fixtures.
- Metadata-only IndexedDB history, retention cap, clearing, and favorites persistence at the storage layer.
- Axe accessibility scans, desktop/mobile horizontal-overflow checks, and reviewed screenshots for tested states.
- Workflow/dependency YAML parsing and least-privilege Pages deployment gates.
- Live development smoke check with rendered sample pages and a downloadable merge result.

## Reproduce

Run inside this repository:

```sh
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test -- --reporter=default --reporter=junit --outputFile=test-results/unit.xml
npm run test:e2e
```

Reports are generated in ignored `playwright-report/` and `test-results/` directories. Unit and browser JUnit files were confirmed present. Browser artifacts use `test-results/browser/` so browser startup does not erase unit reports. Counts above describe the recorded full verification run, not a claim that every subsequent documentation edit reran browser tests.

## Warnings and Unverified Requirements

One advisory React lint warning concerns the current render-task ref used during teardown. Large PDF parser/worker bundles also exceed Vite's advisory chunk-size threshold. These are not build failures or a claim of optimal load performance.

GitHub Actions and Jenkins configuration are present, but were not executed on live GitHub/Jenkins infrastructure. Remote publication, reviewed initial commits, Pages settings, required PR checks, an isolated Jenkins Multibranch runner/webhook, and a distribution-license choice require owner setup. No paid/cloud API or GitHub credit-funded call was used.

Safari/Firefox certification, hostile-file penetration testing, production-load testing, full PDF standards fidelity, signature validation, and secure redaction/sanitization were not verified. Crop boxes, overlays, and standard metadata clearing can leave recoverable content; rewrites may invalidate signatures. See the [README](README.md) for limitations, [Architecture](docs/ARCHITECTURE.md) for HLD/LLD/local BE/DB design, and [Operations](docs/OPERATIONS.md) for deployment.

## Local App Status

The development server is stopped. Restart from this repository with `npm run dev -- --port 5175`, then open http://localhost:5175/. Documents remain in browser memory; IndexedDB stores preferences and job metadata only.
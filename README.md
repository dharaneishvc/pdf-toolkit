# PDF Toolkit

A free, local-first document workbench using PDF.js for reading and pdf-lib for writing. Sources remain in memory and are never uploaded. Outputs are separate downloads; use "Use result as input" to compose further operations.

## Supported catalog: 26 tools

| Category | Implemented tools |
| --- | --- |
| Organize | Ordered merge, individual-page split ZIPs, range extraction/deletion, explicit reorder/repetition, append duplicate pages |
| Page layout | Relative rotation, crop-box view, content-scaled resize, blank-page insertion |
| Compose | Text watermark, selected-page numbers, positioned text, rectangle overlay, PNG/JPEG overlay |
| Convert | PNG/JPEG images to PDF, selected pages to PNG/JPEG ZIPs, selectable-text extraction |
| Document | Standard metadata editing/clearing, document/page-size inspector |
| Forms | Field inspection, JSON-based fill (text/checkbox/dropdown/list/radio), flattening |
| Attachments | Add embedded file, extract embedded attachments to ZIP |

Controls include PDF/image import, drag/drop, generated sample, file order/removal, lazy thumbnails, page selection, preview pagination, downloads/reports/copy, favorites, search, hash links, private history, progress, and cancellation. Empty range means all pages. Ranges use `1,3-5`; reorder permits `3,1,1,2`. Coordinates use PDF points (72 per inch), with Y from the bottom. Numbers increment over selected pages, not absolute source page numbers.

## Run and test

Requires Node.js 24, npm, and a current browser. Chromium desktop/mobile viewports are tested. PDF.js worker/fonts/CMaps/WASM decoders are bundled locally.

```sh
npm ci
npm run dev -- --port 5175
npm run check
npx playwright install chromium
npm run test:e2e
```

Unit tests generate PDFs/forms and inspect structure after transformations. Browser tests check painted previews, real merge/split downloads, text extraction, offscreen image rendering, form fill/flatten, exact attachment preservation, PNG-to-PDF/image overlay, result reuse, invalid/corrupt input, all navigation, axe accessibility, and mobile overflow. Build output is static `dist/`.

## Verification

The recorded verification run passed 47 unit tests and 18 desktop/mobile browser cases for this repository. Builds and dependency audits passed. See [Verification](VERIFICATION.md) for coverage, advisory warnings, reproduction commands, and external deployment requirements. All documentation, dependencies, and CI configuration live in this repository; no parent workspace files are required.

## Safety and limitations

Encrypted/corrupt PDFs are rejected. Limits: 24 inputs/100 MB combined, 300 pages per document/output, 60-second writing-worker timeout, 10 MB added attachments/100 MB expanded extraction, rendered pages at most 16 megapixels/8192 pixels per side and scale 0.25-3.

Copy/merge can discard document-level outlines, metadata, attachments, tags, links to removed pages, and other catalog structures. Full-fidelity preservation is not guaranteed. Copy/remove/resize of editable forms requires explicit flattening first. Page resize scales both axes and may distort content. Crop boxes/rectangles change appearance only: hidden content can remain recoverable. Standard metadata clearing is NOT secure sanitization; it clears common fields/XMP and sets dates to epoch, not every embedded object/file.

Writing uses standard Helvetica/WinAnsi, not arbitrary Unicode shaping. Unsupported characters return a library error. Text extraction follows content stream order; it is not OCR or layout reconstruction. XFA, form creation, Office/HTML conversion, OCR, AI inference, signature creation/verification, PDF/A validation, guaranteed secure redaction, and guaranteed smaller-PDF compression are not implemented. Rewrites can invalidate existing signatures. Never use overlays/cropping to hide secrets.

See [Architecture](docs/ARCHITECTURE.md), [Operations](docs/OPERATIONS.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md). Live GitHub/Jenkins deployment requires external setup and has not been performed locally.
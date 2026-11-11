# Security

Local processing is not a security certification. Report vulnerabilities privately using GitHub's private vulnerability reporting when enabled or a maintainer-approved private channel. Never put secrets, customer documents, or private inputs into public issues.

Considered risks: malicious parsers/regex, expanded-file/canvas memory, generated HTML, spreadsheet formulas, archive paths, accidental persistence, worker leaks, and CI privilege exposure. Guards include bounded inputs/output, worker termination where applicable, inert text, controlled downloads, private metadata storage, and separate least-privilege deployment.

Bounds do not eliminate decompression bombs/parser vulnerabilities. Keep browsers/libraries updated and treat untrusted files cautiously. Same-origin scripts can access IndexedDB; database names are not tenant isolation. Static hosting still receives normal asset requests, and extensions can have their own access. Clear site data on shared devices.

Never embed API keys in frontend bundles. JWT decode is not verification. Blur/pixelation/PDF crops/overlays/standard metadata clearing are not guaranteed redaction or sanitization. Rewrites may invalidate signatures. Embedded files are downloaded as data, never executed by this app; opening them remains the user's responsibility.

Contributor code must not run with production credentials or on privileged/shared workers. Require reviewed, passing PRs and investigate audits rather than globally suppressing them.
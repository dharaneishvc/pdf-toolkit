# Contributing

Use Node.js 24 and the committed lockfile. Branch from `main`, make a focused change, update the supported feature/limitation docs, and open a PR. Do not include private input files, credentials, generated output, or unrelated formatting.

```sh
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test:e2e
```

New tools need a unique catalog ID, actual implementation, input bounds, clear invalid-input states, executable unit examples, and a real browser result/file check. Reuse existing libraries, catalog, shell, and tests. Add both a known result and a disconfirming edge case. File workflows must check exported bytes/structure, not only button visibility.

Preserve keyboard access, icon tooltips/names, contrast, reduced motion, mobile fit, and private metadata-only storage. Do not add paid APIs, frontend secrets, unsafe HTML execution, durable user-content storage, or server requirements without an architecture decision. Disclose unsupported formats, possible data loss, and security implications.

GitHub `verify` is the default gate. Jenkins becomes an additional required check only after actual isolated Multibranch runner setup. Review dependency changes and upstream asset/font licenses. No distribution license has been selected by the workspace owner; choose one before advertising the code as open source.
# Operations and Deployment

## Local checks

Run inside this repository with Node.js 24 and the committed lockfile.

```sh
npm ci
npm run check
npm audit --audit-level=high
npx playwright install chromium
npm run test:e2e
npm run dev
```

`check` runs unit tests, owned-source lint, TypeScript, and production build. Browser tests serve `dist/` on port 4173; keep it free. Chromium desktop/mobile viewports are tested, not Safari. Reports/traces/screenshots are ignored. React advisory warnings are not configured as failures; compiler/lint errors fail. GitHub Actions uses `ubuntu-24.04` and `npx playwright install chromium`; the hosted image provides browser system libraries without requiring apt mirror access. Jenkins retains `npx playwright install --with-deps chromium` in its disposable Docker agent. Build/export limits are documented in README.

## GitHub Pages

1. Create a separate GitHub repository for this folder. Public repositories use the normal free Pages path; private hosting depends on the plan. GitHub model/API credits are not needed.
2. Initialize Git if needed, review and create your first commit, use `main` as the default branch, add your selected remote, and push. No credentials belong in source.
3. In Settings > Pages choose GitHub Actions. The included pipeline runs on PRs/main pushes/manual dispatch. Only successful `main` builds deploy; PR code never receives deployment permissions.
4. Protect `main` with required `verify` status, PR review, and no direct/force pushes. Ruleset availability depends on the GitHub plan.
5. Pages normally publishes at `https://OWNER.github.io/REPOSITORY/`. Hash routes and relative Vite base avoid rewrite rules. Confirm actual asset/worker subpaths after publication.

The deployment job consumes the exact verified production artifact. PR validation has read-only permissions, checkout does not persist credentials, and no contributor code runs under `pull_request_target`. Only deployment has Pages/OIDC write permissions. Review/pin actions to approved immutable SHAs under your supply-chain policy; Dependabot proposes npm/action updates. Pages limits are not unlimited or a commercial SLA.

Rollback by reverting a faulty commit through a reviewed PR and redeploying a passing main build. Never silently disable checks. No remote GitHub publishing or deployment has been executed in this workspace.

## Jenkins PR checks

`Jenkinsfile` uses a disposable Node 24 Docker agent: checkout, locked install, dependency audit, unit JUnit report, lint, build, Playwright setup, desktop/mobile tests, report/artifact archival.

External prerequisites: Jenkins controller/agent, Docker-capable Linux host, Pipeline/Docker Pipeline/GitHub Branch Source/JUnit plugins, and a Multibranch Pipeline for the repository. Configure webhook, branch/fork discovery, and PR status reporting. Make its check required only after a real successful runner verification. A Jenkinsfile does not provision or host Jenkins; it has not been executed locally.

Untrusted fork PRs must use isolated disposable runners, a trusted pipeline definition/approval policy, and no production/deployment secrets. Do not mount a host Docker socket or run privileged/shared workers for contributor code. The Docker-capable host is infrastructure, not an authority to expose it to builds. Jenkins is not made free by GitHub credits.

## Data, recovery, and release

Only tool IDs/job metadata persist. History can be cleared in the UI; site-data controls clear favorites. Browser eviction can erase preferences. File/result recovery after reload is intentionally unavailable; download results before closing. Changing the HTML title changes its database name and requires a migration decision.

Release gate: locked install, check, audit, browser tests; review desktop/mobile screenshots and actual exports; verify Pages subpaths/resource MIME; update feature/limit docs; exclude secrets/user files/node_modules/builds/reports; verify required PR checks and rollback settings on the actual repository. Local testing is not live GitHub/Jenkins validation, browser-engine certification, penetration testing, or production traffic testing. The owner must select a distribution license before advertising this as open source.
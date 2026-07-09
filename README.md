# DayBook — QA Automation Suite

Automated test suite for the **DayBook** MERN journaling app
([TheNileshNishad/daybook](https://github.com/TheNileshNishad/daybook)), covering:

- **End-to-end functional tests** — Playwright (TypeScript), real UI journeys for authentication and journal CRUD/search.
- **API tests** — Jest + Supertest, every REST endpoint and its status codes/validation.
- **Bug report & test documentation** — [`docs/BUG-REPORT.md`](docs/BUG-REPORT.md), [`docs/TEST-CASES.md`](docs/TEST-CASES.md).

> **Results:** 13 E2E tests ✅ · 43 API tests ✅ (+1 skipped) · **8 confirmed issues** filed (1 Critical, 1 High,
> 3 Medium, 3 Low) — plus 2 suspected issues investigated against the live app and dismissed.
>
> Every issue in the report was **reproduced against a running instance** (API probes + Playwright + live UI via
> BrowserOS) before being filed — nothing is inferred from source alone.

> ⚠️ **Before you run anything, read [§8 Disclaimers & known-destructive behavior](#8-disclaimers--known-destructive-behavior).**
> One documented bug (BUG-01) crashes the DayBook backend on purpose, `1 skipped` test and the `test.failing` cases are
> **intentional**, and "all green" is the expected healthy result.

---

## Author's note — what this is, and why I built it this way

I built this suite the way I build and maintain real test automation as a senior QA: **from scratch, to last.** It isn't a
pile of scripts that happens to pass today — it's a harness a team can run, read, and extend months from now without it
rotting. Everything here is a deliberate choice from experience owning an application's quality end to end.

**What's here, and the reason for each piece:**

- **Two test layers, on purpose.** API tests (Jest + Supertest) pin every endpoint's status codes and validation
  deterministically; E2E tests (Playwright) prove the real user journeys through the UI. I test each risk at the layer
  where it's cheapest and least flaky — I don't push everything through a browser.
- **Built to stay maintainable.** Page objects keep selectors in one place, typed fixtures kill setup duplication, and
  unique per-test data lets the whole thing run in parallel against a shared DB. These aren't decorations — they're what
  stops a suite from collapsing under its own weight past 50 tests.
- **Findings are verified before they're filed.** I reproduce every bug against a running instance (API + live UI via
  BrowserOS) before it enters the report. On this app that discipline paid off: I caught **two of my own suspected bugs
  as false positives** and corrected a third's reproduction. A QA report that cries wolf is worse than none.
- **Known bugs are executable, not just prose.** Confirmed defects are encoded as `test.failing`, so the day a developer
  fixes one, the suite tells them. The single destructive crash (BUG-01) is a documented `skip` for a spelled-out reason
  (§8) — I don't let one app defect take the whole run hostage.
- **Everything explains its *why*.** Every design decision has a reason written next to it (§7), every spec carries
  preconditions/steps/expected results, and the CI reproduces the entire stack (Mongo + backend + frontend + tests) from
  a cold runner — **verified green on GitHub Actions**, not just theorised.

That instinct — *test at the right layer, isolate your data, verify before you claim, and document the why so anyone can
maintain it* — is what I bring as a QA who builds and keeps a suite alive over time. The tools are just how it gets
expressed.

---

## Quick start (TL;DR)

```bash
# 1. Start the app under test (backend :3000 + frontend :5173) — see §2 for details
# 2. Then, in this repo:
npm install          # deps + Playwright Chromium
npm test             # runs the API suite, then the E2E suite
```

Prefer to run one layer at a time? `npm run test:api` or `npm run test:e2e`.
Full step-by-step (including how to launch DayBook) is below.

---

## 1. Prerequisites

- **Node.js** ≥ 18
- **MongoDB** running locally (a `mongodb://localhost:27017` instance, or Docker, or `mongodb-memory-server`)
- The **DayBook app** cloned and running (backend + frontend) — see §2

## 2. Start the application under test

Clone and run DayBook in a **separate** folder (this repo only contains the tests):

```bash
git clone https://github.com/TheNileshNishad/daybook.git
cd daybook

# --- backend ---
cd backend
npm install
cat > .env <<'EOF'
PORT=3000
MONGO_URI=mongodb://localhost:27017/daybook
JWT_SECRET=test-secret
FRONTEND_URL=http://localhost:5173
EOF
npm run dev        # -> http://localhost:3000

# --- frontend (new terminal) ---
cd ../frontend
npm install
echo "VITE_BACKEND_URL=http://localhost:3000" > .env
npm run dev        # -> http://localhost:5173
```

> No local MongoDB? You can run one in memory:
> `npx mongodb-memory-server` or `docker run -p 27017:27017 mongo`.

## 3. Install the test suite

```bash
cd daybook-qa-automation
npm install                 # installs deps + Playwright Chromium
cp .env.example .env        # optional; defaults already point at the ports above
```

## 4. Run the tests

```bash
npm test              # runs API tests, then E2E tests

# or individually:
npm run test:api      # Jest + Supertest  (needs the backend running)
npm run test:e2e      # Playwright        (needs backend + frontend running)

npm run test:e2e:headed   # watch the browser
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:report   # open the last HTML report
```

Override target URLs if you run on different ports:

```bash
BACKEND_URL=http://localhost:3000 FRONTEND_URL=http://localhost:5173 npm test
```

---

## 5. Project structure

```
daybook-qa-automation/
├── .github/workflows/
│   └── e2e-tests.yml           # dormant CI (manual/scheduled) — see §6
├── playwright.config.ts        # E2E config (baseURL from FRONTEND_URL)
├── e2e/
│   ├── pages/                  # Page objects: Login, Signup, NavBar, Entries
│   ├── support/                # fixtures, test-data factories, API seed helpers
│   └── tests/
│       ├── auth/               # A01–A05: signup, login/logout, profile, password, edge cases
│       └── entries/            # E01–E04: create, search, edit/delete, edge cases
├── api/
│   ├── jest.config.js
│   ├── support/client.ts       # Supertest client + auth-cookie handling + data factories
│   └── tests/
│       ├── auth.api.test.ts
│       ├── users.api.test.ts
│       ├── entries.api.test.ts
│       └── known-issues.api.test.ts   # executable documentation of confirmed bugs
└── docs/
    ├── BUG-REPORT.md           # 8 confirmed issues (+2 investigated/dismissed), severity, repro, fixes
    ├── TEST-CASES.md           # full test matrix + testing strategy
    └── BROWSEROS-QA-FLOW.md    # agentic exploratory + auto-triage layer (BrowserOS → ClickUp/Jira)
```

## 6. Continuous integration (optional)

A GitHub Actions workflow is included at
[`.github/workflows/e2e-tests.yml`](.github/workflows/e2e-tests.yml). It spins up MongoDB, clones and starts the
DayBook app (backend + frontend), then runs the **API and E2E suites** and uploads the Playwright HTML report as an
artifact.

> ✅ **Verified:** this workflow has been run on GitHub Actions and completes green — `1 skipped, 43 passed` (API) and
> `13 passed` (E2E), with the Playwright HTML report attached as a run artifact. The whole app-under-test (Mongo +
> backend + frontend) is provisioned by the workflow itself; nothing needs to be pre-built.

It is **dormant by design** — it does **not** run on push or pull request. Run it only when needed:

- **Manually:** GitHub → **Actions** tab → **DayBook QA Suite** → **Run workflow**.
- **On a schedule:** uncomment the `schedule:` / `cron:` block at the top of the workflow file (times are UTC), e.g.
  `'0 6 * * 1'` for every Monday at 06:00.

No secrets are required; the workflow provisions its own throwaway Mongo + JWT secret.

## 7. Why it's built this way (design decisions & rationale)

Every choice below is deliberate — here is the reasoning, so a reviewer can see the *why*, not just the *what*.

| Decision | Why |
|----------|-----|
| **Two layers: API (Jest+Supertest) + E2E (Playwright)** | Test each concern where it's cheapest and most reliable. The API layer nails status codes/validation deterministically (no UI flakiness); the E2E layer proves the real user journeys. Both tools are on the assignment's allowed list, and Playwright matches the day-to-day stack. |
| **Page Object Model** (`e2e/pages/`) | Keep every selector in one place, so a UI change is a one-line fix instead of edits across many specs — and specs read like user stories, not selector soup. |
| **Typed fixtures** (`e2e/support/fixtures.ts`, `test.extend`) | DRY setup: each test gets ready-made page objects, a pre-registered `user`, and an `authedPage` — with per-test isolation baked in. |
| **Unique data factories** (pid + timestamp + random) | Every test creates its own user/entry, so the whole suite runs in parallel against one shared DB with zero collisions. (We actually hit a real duplicate-email race at high worker counts; this is the fix.) |
| **Arrange via API, assert via UI** | Seed prerequisites fast over HTTP, then spend the test's assertions on the behaviour under test rather than re-driving signup through the UI every time. |
| **Log in through the UI on every E2E test** (not `storageState`) | Exercise the real auth flow end-to-end on every run. The app *does* rehydrate from the cookie (via `Layout`'s `GET /users/me`), so `storageState` reuse would also work — driving the login form is a **coverage** choice, not a workaround. |
| **Manual cookie threading in API tests** (`api/support/client.ts`) | The app issues its auth cookie as `Secure; SameSite=None`; superagent/axios cookie jars refuse to replay `Secure` cookies over plain HTTP (**BUG-10**). So we capture `Set-Cookie` and set it by hand — robust regardless of the jar. |
| **`test.failing` for confirmed backend bugs** (`known-issues.api.test.ts`) | Encode the *correct* expected behaviour. It reports **green today** (because the app is buggy) and turns **red the moment the bug is fixed** — a built-in regression alarm. See §8. |
| **`test.skip` for BUG-01** | Exercising it **crashes the whole backend process**; running it in-band would cascade-fail every later test. Parked as a documented skip with a full repro in comments. See §8. |
| **No Playwright `webServer`** | The app needs a MongoDB instance provisioned outside this repo, so the suite doesn't auto-boot it — the README (and CI) start it explicitly and predictably. |
| **Dormant CI** (`workflow_dispatch` only) | Don't auto-run or incur cost on every push. It's ready to run manually or on a schedule when wanted (§6). |
| **Chromium-only project** | The assignment scope is one browser. Locators are accessibility/role-based, so adding Firefox/WebKit is a config-only change. |
| **Agentic layer (BrowserOS)** | Exploratory testing + **live verification** of each finding + auto-file to the tracker. In this project it caught **two false positives** and **corrected one repro** before they reached the report — see [`docs/BROWSEROS-QA-FLOW.md`](docs/BROWSEROS-QA-FLOW.md). When a tracker is connected it **creates the bug card automatically**; no live tracker access was wired here, so the docs show the exact payload it would post. |

## 8. Disclaimers & known-destructive behavior

Please read these before running — the items below are **intentional**, not mistakes:

- **This suite tests the DayBook app *as-is*.** Every issue in [`docs/BUG-REPORT.md`](docs/BUG-REPORT.md) is a defect **in
  the application**, not in the tests. The test code itself is fully green: **43 API + 13 E2E passing**.
- **⚠️ One bug (BUG-01) crashes the DayBook backend on purpose — and its test is therefore `skip`-ped.**
  `PUT /api/users/me` with the `lastName` key **omitted** throws an unhandled `TypeError` *outside* the try/catch and
  **kills the Node process** (verified live). Running that live in the suite would take the server down and fail every
  test after it, so it is `test.skip` with a full reproduction in the comments. **If you manually reproduce BUG-01 (or
  anything trips it), the backend will be DOWN — just restart it** (`npm start` / `npm run dev` in `daybook/backend`).
  That is application behaviour, not a test failure.
- **`test.failing` cases report as PASSING on purpose.** The 5 cases in `known-issues.api.test.ts` assert what a *correct*
  API *should* return. They pass **because** the app currently returns the wrong thing; the day a bug is fixed, that case
  starts **failing** to alert you. So the healthy, expected result of a full run is **`1 skipped, 43 passed` (API)** and
  **`13 passed` (E2E)** — "all green with one skip" is correct.
- **API cookie handling is manual by necessity** (BUG-10, see §7) — nothing to configure, just noted so the extra
  `Set-Cookie` plumbing in `api/support/client.ts` isn't mistaken for accidental complexity.
- **Test data is disposable.** Tests create uniquely-named throwaway users/entries in whatever database the app points
  at. Point the app at a **scratch DB**, never production data.

## 9. Troubleshooting

| Symptom | Cause & fix |
|---------|-------------|
| API tests fail with `ECONNREFUSED` / `connect` errors | The DayBook **backend** is not running on `:3000`. Start it (§2) or set `BACKEND_URL`. |
| E2E tests time out on the first navigation | The DayBook **frontend** is not running on `:5173`. Start it (§2) or set `FRONTEND_URL`. |
| Backend logs `Database not connected!` | **MongoDB** is not reachable. Start Mongo (`docker run -p 27017:27017 mongo` or `mongod`) and restart the backend. |
| `browserType.launch: Executable doesn't exist` | Playwright browser missing — run `npx playwright install chromium`. |
| The backend went down / API tests suddenly all fail with connection errors | You (or something) triggered **BUG-01**, which crashes the server (§8). Restart the backend; the suite keeps that case `skip`-ped for exactly this reason. |
| A `test.failing` case is reported as **failing** (red) | That means the corresponding **app bug was fixed** 🎉 — promote it from `test.failing` to a normal `test` (§8). |

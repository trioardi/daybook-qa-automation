# DayBook — QA Automation Suite

Automated test suite for the **DayBook** MERN journaling app
([TheNileshNishad/daybook](https://github.com/TheNileshNishad/daybook)), covering:

- **End-to-end functional tests** — Playwright (TypeScript), real UI journeys for authentication and journal CRUD/search.
- **API tests** — Jest + Supertest, every REST endpoint and its status codes/validation.
- **Bug report & test documentation** — [`docs/BUG-REPORT.md`](docs/BUG-REPORT.md), [`docs/TEST-CASES.md`](docs/TEST-CASES.md).

> **Results:** 13 E2E tests ✅ · 43 API tests ✅ (+1 skipped) · **10 confirmed bugs** filed (1 Critical).

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
cd daybook-qa-assessment
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
daybook-qa-assessment/
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
    ├── BUG-REPORT.md           # 10 confirmed defects, severity, repro, fixes
    └── TEST-CASES.md           # full test matrix + testing strategy
```

## 6. Continuous integration (optional)

A GitHub Actions workflow is included at
[`.github/workflows/e2e-tests.yml`](.github/workflows/e2e-tests.yml). It spins up MongoDB, clones and starts the
DayBook app (backend + frontend), then runs the **API and E2E suites** and uploads the Playwright HTML report as an
artifact.

It is **dormant by design** — it does **not** run on push or pull request. Run it only when needed:

- **Manually:** GitHub → **Actions** tab → **DayBook QA Suite** → **Run workflow**.
- **On a schedule:** uncomment the `schedule:` / `cron:` block at the top of the workflow file (times are UTC), e.g.
  `'0 6 * * 1'` for every Monday at 06:00.

No secrets are required; the workflow provisions its own throwaway Mongo + JWT secret.

## 7. Notes on a few deliberate design choices

- **Login happens through the UI in every E2E test.** DayBook does not rehydrate its session on reload (see BUG-07),
  so a stored cookie alone does not make the UI appear logged in — reusing Playwright `storageState` would not work.
  Specs therefore seed data via the API but log in through the real login form.
- **The API auth cookie is `Secure; SameSite=None`** (BUG-10). Superagent/axios cookie jars refuse to replay `Secure`
  cookies over plain HTTP, so the API suite captures the `Set-Cookie` value and threads it manually.
- **Confirmed backend bugs are encoded as `test.failing`** so the suite is green today and turns red the moment a bug
  is fixed — see [`docs/TEST-CASES.md` §4](docs/TEST-CASES.md).

## 8. Troubleshooting

| Symptom | Cause & fix |
|---------|-------------|
| API tests fail with `ECONNREFUSED` / `connect` errors | The DayBook **backend** is not running on `:3000`. Start it (§2) or set `BACKEND_URL`. |
| E2E tests time out on the first navigation | The DayBook **frontend** is not running on `:5173`. Start it (§2) or set `FRONTEND_URL`. |
| Backend logs `Database not connected!` | **MongoDB** is not reachable. Start Mongo (`docker run -p 27017:27017 mongo` or `mongod`) and restart the backend. |
| `browserType.launch: Executable doesn't exist` | Playwright browser missing — run `npx playwright install chromium`. |
| API suite fails right after a profile test | You may have triggered **BUG-01** (server crash). Restart the backend; the suite keeps that case `skip`-ped for exactly this reason. |

> **Note:** the suite tests the DayBook app *as-is*. The 10 documented bugs are defects **in the application**, not in
> the tests — the test suite itself is fully green (see [`docs/TEST-CASES.md`](docs/TEST-CASES.md) §5).

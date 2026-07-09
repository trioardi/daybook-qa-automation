# DayBook — Test Case Documentation & Testing Strategy

**Application under test:** DayBook — a MERN (MongoDB, Express, React, Node) personal journaling app
**Author:** Satrio Ardiman (trioardi) · **Date:** 2026-07-09
**Deliverables:** Playwright E2E suite · Jest + Supertest API suite · Bug report · This document

---

## 1. Testing strategy

### 1.1 Objective
Validate the two core user journeys the brief calls out — **Authentication** (signup, login, logout, update details,
change password, edge cases) and **Journal Entry CRUD + Search** — across both layers of the stack, and surface any
correctness/UX defects with reproducible evidence.

### 1.2 Test pyramid & tool choice
Each concern is tested at the layer where it is cheapest and most reliable:

| Layer | Tool | What it covers | Why |
|-------|------|----------------|-----|
| **API / integration** | Jest + Supertest | Every REST endpoint, all status codes, validation rules, ownership/isolation | Fast, deterministic, exhaustive on edge cases without UI flakiness |
| **E2E / UI** | Playwright (TypeScript) | Real user journeys through the React UI against the live API | Confirms the wiring the user actually experiences |
| **Exploratory** | Manual smoke + API probing | UI/UX inconsistencies, invalid input, crash cases | Finds what scripted tests assume away |

### 1.3 Design principles applied
- **Test isolation** — every test provisions its own uniquely-named user/entry (timestamp + process id + random), so
  the suite runs fully in parallel against a shared database with no cross-test coupling.
- **Arrange via API, assert via UI** — E2E specs seed prerequisite state through the API for speed, then drive and
  assert the behaviour under test through the UI.
- **Meaningful assertions** — specs verify specific content (the created entry's title/mood/content, the exact error
  message, that the *new* password works and the *old* one is rejected) — not just navigation.
- **Positive + negative coverage** — each feature has happy-path and edge-case cases.
- **Executable bug documentation** — confirmed backend defects are encoded as `test.failing` cases so the suite stays
  green today but automatically flags the day each bug is fixed (see §5).

### 1.4 Scope
**In scope:** all documented REST endpoints; signup/login/logout/profile/password UI flows; entry create/read/update/
delete/search UI flows; input validation; auth/ownership boundaries.
**Out of scope:** load/performance, security pen-testing, cross-browser matrix (Chromium-first, browser-agnostic code),
visual regression, email delivery (app has none).

### 1.5 Test environment
| Component | Value |
|-----------|-------|
| Frontend | React + Vite @ `http://localhost:5173` |
| Backend | Node/Express @ `http://localhost:3000` |
| Database | MongoDB (local / in-memory) |
| Runner | Playwright 1.60 (Chromium), Jest 29 + Supertest 7, Node 18+ |

---

## 2. Traceability matrix (summary)

| ID | Module | Title | Type | Priority | Status |
|----|--------|-------|------|----------|--------|
| A01 | Auth | Signup — happy path (auto-login) | Positive | High | ✅ Pass |
| A02 | Auth | Login + Logout | Positive | High | ✅ Pass |
| A03 | Auth | Update personal details | Positive | Medium | ✅ Pass |
| A04 | Auth | Change password (old rejected / new accepted) | Positive | High | ✅ Pass |
| A05a | Auth | Login with incorrect password | Negative | High | ✅ Pass |
| A05b | Auth | Login with empty fields | Negative | Medium | ✅ Pass |
| A05c | Auth | Signup with duplicate email | Negative | Medium | ✅ Pass |
| A05d | Auth | Signup with weak password | Negative | Medium | ✅ Pass |
| E01 | Entries | Create entry & verify on list | Positive | High | ✅ Pass |
| E02 | Entries | Search by title & content (+ no-result) | Positive | High | ✅ Pass |
| E03 | Entries | Edit & delete entry (CRUD lifecycle) | Positive | High | ✅ Pass |
| E04a | Entries | Create entry — title > 20 chars | Negative | Medium | ✅ Pass |
| E04b | Entries | Create entry — empty required fields | Negative | Medium | ✅ Pass |
| API-* | API | 43 endpoint cases (see §4) | Pos/Neg | High | ✅ Pass |
| BUG-* | Defects | 6 known-defect cases (see §5) | Defect | — | 🐞 Documented |

---

## 3. Detailed E2E test cases (Playwright)

Location: [`e2e/tests`](../e2e/tests) · Run: `npm run test:e2e`
Each case below maps 1:1 to a spec file. "Expected results" are the actual assertions in the code.

---

### A01 — Signup (happy path)
- **File:** `e2e/tests/auth/A01-signup.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** App running; the email is not yet registered.
- **Test data:** Unique valid user (`firstName: Alex`, `lastName: Tester`, unique email, password `Passw0rd!`, which meets the strong-password rule).
- **Steps:**
  1. Navigate to `/signup`.
  2. Fill First Name, Last Name, Email, Password.
  3. Click **Sign up**.
- **Expected results:**
  - App auto-logs-in and redirects to Home (`/`).
  - Home shows the heading **"Welcome Back, Alex"**.
  - Navbar shows the profile dropdown trigger with the user's first name.

---

### A02 — Login + Logout
- **File:** `e2e/tests/auth/A02-login-logout.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** A registered user exists (seeded via API).
- **Test data:** The seeded user's email + password.
- **Steps:**
  1. Navigate to `/login` and log in with valid credentials.
  2. Confirm authenticated state.
  3. Open the navbar profile dropdown → **Log out** → confirm in the modal.
- **Expected results:**
  - Login redirects to Home with the **"Welcome Back, {name}"** heading and the profile dropdown visible.
  - After logout, the public **"Log In"** button reappears (session cleared).

---

### A03 — Update personal details
- **File:** `e2e/tests/auth/A03-update-personal-details.spec.ts` · **Type:** Positive · **Priority:** Medium
- **Preconditions:** Logged-in user.
- **Test data:** New name (`firstName: Alexis`, `lastName: Updated`).
- **Steps:**
  1. Open navbar dropdown → **Profile**.
  2. Change First Name and Last Name.
  3. Click **Save Changes**.
- **Expected results:**
  - Success toast **"Profile updated successfully!"** is shown.
  - `GET /api/users/me` confirms the profile persisted the new first + last name (server-side verification).

---

### A04 — Change password
- **File:** `e2e/tests/auth/A04-change-password.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** Logged-in user.
- **Test data:** Old password `Passw0rd!`, new password `NewPass9!`.
- **Steps:**
  1. Open navbar dropdown → **Change Password**.
  2. Enter old + new password → **Change Password**.
  3. Log out.
  4. Log in with the **new** password.
  5. Log out and attempt login with the **old** password.
- **Expected results:**
  - Success toast **"Password changed successfully!"**.
  - Login with the **new** password succeeds (authenticated navbar).
  - Login with the **old** password fails with **"Invalid credentials!"**.

---

### A05a — Login with an incorrect password
- **File:** `e2e/tests/auth/A05-auth-edge-cases.spec.ts` · **Type:** Negative · **Priority:** High
- **Preconditions:** A registered user exists.
- **Test data:** Correct email + wrong password `WrongPass9!`.
- **Steps:**
  1. Navigate to `/login`, enter the email and the wrong password, submit.
- **Expected results:**
  - Error **"Invalid credentials!"** is shown.
  - User remains logged out and stays on `/login`.

---

### A05b — Login with empty fields
- **File:** `e2e/tests/auth/A05-auth-edge-cases.spec.ts` · **Type:** Negative · **Priority:** Medium
- **Preconditions:** None.
- **Test data:** Empty email + password.
- **Steps:**
  1. Navigate to `/login` and click **Log in** with both fields empty.
- **Expected results:**
  - HTML5 required-field validation blocks submission (email field reports `validity.valid === false`).
  - No navigation occurs; the user stays on `/login`.

---

### A05c — Signup with a duplicate email
- **File:** `e2e/tests/auth/A05-auth-edge-cases.spec.ts` · **Type:** Negative · **Priority:** Medium
- **Preconditions:** A user is already registered with the target email.
- **Test data:** New details but a reused email.
- **Steps:**
  1. Navigate to `/signup`, fill valid details using the already-registered email, submit.
- **Expected results:**
  - Error **"User already exist!"** is shown; no new account is created.

---

### A05d — Signup with a weak password
- **File:** `e2e/tests/auth/A05-auth-edge-cases.spec.ts` · **Type:** Negative · **Priority:** Medium
- **Preconditions:** None.
- **Test data:** Valid details, password `weak`.
- **Steps:**
  1. Navigate to `/signup`, fill details with a weak password, submit.
- **Expected results:**
  - Error **"Please enter strong password!"** is shown; no account is created.

---

### E01 — Create a journal entry
- **File:** `e2e/tests/entries/E01-create-entry.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** Logged-in user on `/entries`.
- **Test data:** Unique title (≤20 chars), mood `🙂 Happy`, today's date, descriptive content.
- **Steps:**
  1. Click the floating **"+"** button.
  2. Fill Title, Date, Mood, Content in the Add-entry modal.
  3. Click **Save Entry**.
- **Expected results:**
  - Success toast **"Entry added successfully!"**.
  - A new entry card is generated showing the **mood + title** in its heading and the entry content.

---

### E02 — Search entries by title and content
- **File:** `e2e/tests/entries/E02-search-entry.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** Logged-in user with two seeded entries (`Alpha…` and `Beta…`, where Beta's content contains the word "kangaroo").
- **Test data:** Search terms: the Alpha title, the word `kangaroo`, and `zzz-no-such-entry-zzz`.
- **Steps:**
  1. Search by the Alpha entry's title.
  2. Search by `kangaroo` (a word that only appears in Beta's content).
  3. Search by a term that matches nothing.
- **Expected results:**
  - Search by title → only the **Alpha** card is shown; Beta is absent.
  - Search by content word → only the **Beta** card is shown; Alpha is absent.
  - No-match search → the friendly empty state **"…couldn't find any entries matching your search query"** is shown.

---

### E03 — Edit and delete an entry (CRUD lifecycle)
- **File:** `e2e/tests/entries/E03-edit-delete-entry.spec.ts` · **Type:** Positive · **Priority:** High
- **Preconditions:** Logged-in user with one seeded entry.
- **Test data:** New title `Edited…`, new content "Rewrote the whole day after some reflection."
- **Steps:**
  1. On the entry card, click the **edit** (pencil) icon.
  2. Wait for the modal to hydrate, change Title + Content, click **Save Changes**.
  3. On the updated card, click the **delete** (trash) icon → **Confirm**.
- **Expected results:**
  - Toast **"Entry updated successfully!"**; the card now shows the new title + content, and the old title is gone.
  - Toast **"Entry deleted successfully!"**; the card is removed from the list.

---

### E04a — Create entry with a title longer than 20 characters
- **File:** `e2e/tests/entries/E04-entry-edge-cases.spec.ts` · **Type:** Negative · **Priority:** Medium
- **Preconditions:** Logged-in user on `/entries`.
- **Test data:** 33-character title.
- **Steps:**
  1. Open the Add-entry modal, fill a >20-char title with otherwise valid fields, click **Save Entry**.
- **Expected results:**
  - Error **"Title length should not be more than 20 characters!"** is shown; no entry is created.

---

### E04b — Create entry with empty required fields
- **File:** `e2e/tests/entries/E04-entry-edge-cases.spec.ts` · **Type:** Negative · **Priority:** Medium
- **Preconditions:** Logged-in user on `/entries`.
- **Test data:** All fields empty.
- **Steps:**
  1. Open the Add-entry modal and click **Save Entry** without filling anything.
- **Expected results:**
  - HTML5 required-field validation blocks submission (Title reports `validity.valid === false`); the modal stays open.

---

## 4. API test cases (Jest + Supertest)

Location: [`api/tests`](../api/tests) · Run: `npm run test:api`
Each row is one test case: the **Request** column is the step, the **Expected result** column is the assertion.

### 4.1 Authentication — `auth.api.test.ts`
| # | Request (step) | Expected result |
|---|----------------|-----------------|
| 1 | `POST /auth/signup` with valid data | **201**; profile returned (email/first/last), no password echoed; auth cookie set |
| 2 | `POST /auth/signup` with an existing email | **422** "User already exist!" |
| 3 | `POST /auth/signup` missing password | **400** "Fill all required fields!" |
| 4 | `POST /auth/signup` with `not-an-email` | **422** "Invalid email format!" |
| 5 | `POST /auth/signup` with password `weak` | **422** "Please enter strong password!" |
| 6 | `POST /auth/login` with valid creds | **200** "User logged in successfully!"; cookie set |
| 7 | `POST /auth/login` with wrong password | **401** "Invalid credentials!" |
| 8 | `POST /auth/login` unknown user | **401** "Invalid credentials!" |
| 9 | `POST /auth/logout` | **200** "Logout successfully!" |
| 10 | `PUT /auth/change-password` valid old+new | **200**; new password logs in, old password → 401 |
| 11 | `PUT /auth/change-password` no auth cookie | **401** |
| 12 | `PUT /auth/change-password` only old provided | **400** "Both old and new passwords are required!" |
| 13 | `PUT /auth/change-password` wrong old | **401** "Old Password is incorrect!" |
| 14 | `PUT /auth/change-password` new == old | **422** "New password must differ!" |
| 15 | `PUT /auth/change-password` weak new | **422** "Please enter strong password!" |

### 4.2 User profile — `users.api.test.ts`
| # | Request (step) | Expected result |
|---|----------------|-----------------|
| 1 | `GET /users/me` authenticated | **200**; correct email/first/last |
| 2 | `GET /users/me` no cookie | **401** "No token found! Please log in and try again!" |
| 3 | `PUT /users/me` with first+last | **200**; re-fetch confirms persistence |
| 4 | `PUT /users/me` empty firstName | **422** "First name is required!" |
| 5 | `PUT /users/me` no cookie | **401** |

### 4.3 Journal entries — `entries.api.test.ts`
| # | Request (step) | Expected result |
|---|----------------|-----------------|
| 1 | `POST /entries` valid | **201**; saved document returned |
| 2 | `POST /entries` missing title | **422** "Please submit with required fields!" |
| 3 | `POST /entries` `date: not-a-date` | **422** "Please provide a valid date!" |
| 4 | `POST /entries` title > 20 chars | **422** "Title length should not be more than 20 characters!" |
| 5 | `POST /entries` content > 1500 chars | **422** |
| 6 | `POST /entries` no cookie | **401** |
| 7 | `GET /entries` | **200**; array includes the created entry |
| 8 | `GET /entries/:id` valid | **200**; correct document |
| 9 | `GET /entries/:id` non-existent (well-formed id) | **404** |
| 10 | `GET /entries/:id` for another user's entry | **404** (ownership isolation) |
| 11 | `PATCH /entries/:id` valid | **200**; fields updated |
| 12 | `PATCH /entries/:id` non-existent | **404** |
| 13 | `DELETE /entries/:id` then delete again | **200**, then **404** |
| 14 | `GET /entries/search?text=<title>` | **200**; match returned |
| 15 | `GET /entries/search?text=<word in content>` | **200**; match returned |
| 16 | `GET /entries/search?text=<no match>` | **200** "No entries found!"; empty array |
| 17 | `GET /entries/search` (no text) | **400** "Search text is required!" |
| 18 | `GET /entries/search?text=<101 chars>` | **422** |

**API total: 43 tests passing + 1 skipped** (the destructive crash case, BUG-01).

---

## 5. Known-defect tests (executable bug documentation)

Location: [`api/tests/known-issues.api.test.ts`](../api/tests/known-issues.api.test.ts).

Confirmed backend defects are encoded as Jest **`test.failing`** cases that assert the *correct* expected behaviour.
Because the app is currently buggy, these are reported **green** (the assertion is expected to fail). If a developer
fixes the bug, the corresponding `test.failing` starts failing loudly — a built-in regression alarm. **BUG-01** is
`test.skip` because running it crashes the shared server; its full repro lives in the test file and the bug report.

| Test | Maps to | Current behaviour | Correct behaviour |
|------|---------|-------------------|-------------------|
| signup without email | BUG-02 | 500 | 400 |
| login empty body | BUG-03 | 500 | 400 |
| get entry malformed id | BUG-04 | 500 | 4xx |
| search regex metachar `(` | BUG-05 | 500 | < 500 |
| create entry invalid mood | BUG-06 | 500 | 422 |
| update profile w/o lastName | BUG-01 | **process crash** | ≤ 4xx (skipped) |

Full analysis, severity and fixes: [`docs/BUG-REPORT.md`](./BUG-REPORT.md).

---

## 6. Results summary

| Suite | Tests | Result |
|-------|-------|--------|
| API (Jest + Supertest) | 44 (43 pass, 1 skip) | ✅ Green |
| E2E (Playwright) | 13 | ✅ Green (stable at 4 parallel workers) |
| Confirmed issues | 8 filed | 1 Critical, 1 High, 3 Medium, 3 Low (+2 suspected issues investigated & dismissed) |

### Headline finding
**BUG-01 (Critical):** `PUT /api/users/me` with the optional `lastName` **omitted** throws an unhandled `TypeError`
outside the try/catch and **crashes the entire Node process** — a one-request denial of service for every user.
Triggered by direct API consumers (the shipped UI sends `lastName: ""`, which is safe — verified live via BrowserOS).
This should be fixed first.

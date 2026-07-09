# DayBook — Bug Report

**Application:** DayBook (MERN journal app) — https://github.com/TheNileshNishad/daybook
**Tester:** Eric
**Date:** 2026-07-09
**Environment:** Backend `localhost:3000` (Node) · Frontend `localhost:5173` (Vite/React) · MongoDB local
**Method:** Automated API probing (Supertest/axios), automated E2E (Playwright), and manual exploratory/smoke testing.

Every defect below was **reproduced and confirmed** against a locally running instance. IDs map 1:1 to the executable
documentation in [`api/tests/known-issues.api.test.ts`](../api/tests/known-issues.api.test.ts).

## Severity summary

| ID | Severity | Area | One-line summary |
|----|----------|------|------------------|
| **BUG-01** | 🔴 Critical | `PUT /api/users/me` | An API request that **omits** the optional `lastName` **crashes the whole server process** (not reachable via the shipped UI) |
| **BUG-05** | 🟠 High | `GET /api/entries/search` | Search terms with regex metacharacters (e.g. `(`) cause an unhandled 500 |
| **BUG-04** | 🟡 Medium | `GET /api/entries/:id` | A malformed entry id returns 500 instead of 400/404 |
| **BUG-02** | 🟡 Medium | `POST /api/auth/signup` | Missing `email` returns 500 instead of 400 |
| **BUG-03** | 🟡 Medium | `POST /api/auth/login` | Empty request body returns 500 instead of 400 |
| **BUG-06** | 🟢 Low | `POST /api/entries` | An out-of-enum `mood` returns 500 instead of 422 |
| **BUG-09** | 🟢 Low (UX) | Frontend / search | A search server-error (BUG-05) renders a misleading "no entries yet" empty state |
| **BUG-10** | 🟢 Low (config) | Backend / cookies | Auth cookie is `Secure; SameSite=None`, so it is unusable over plain HTTP by non-browser clients |

> **Two earlier suspected issues were disproven by live testing and are NOT bugs** — see
> [§ Investigated — not defects](#investigated--not-defects) at the end. Findings are only listed above after being
> reproduced against a running instance (API probes + Playwright + live UI via BrowserOS).

---

## BUG-01 — Omitting `lastName` on `PUT /api/users/me` crashes the server 🔴 Critical

**Endpoint:** `PUT /api/users/me`
**Type:** Availability / unhandled exception (Denial of Service)

### Steps to reproduce (API)
1. Sign up / log in a user to obtain the auth cookie.
2. Send `PUT /api/users/me` with a first name but **no** `lastName` field:
   ```
   PUT /api/users/me
   Cookie: token=<jwt>
   Content-Type: application/json

   { "firstName": "OnlyFirst" }
   ```
3. Observe the response.

### Trigger condition (verified)
The crash happens only when the `lastName` **key is omitted** from the request body (i.e. `lastName === undefined`).
This was verified end-to-end:

| Request body | Result |
|--------------|--------|
| `{ "firstName": "X" }` (lastName omitted) | 🔴 **server process crashes** |
| `{ "firstName": "X", "lastName": "" }` (empty string) | ✅ 200 OK, handled fine |

**Not reachable through the normal DayBook UI.** I confirmed via the live UI (BrowserOS) that signing up without a
last name and clicking **Profile → Save Changes** does **not** crash the server: the React form always sends
`lastName: ""` (an empty string), which the backend handles. The crash is reached by **direct API consumers** that
omit the field — e.g. another service, a script, an attacker, or the app's own RTK layer if `lastName` were ever
`undefined` (as it is for any account seeded through the API without a last name).

### Expected
`200 OK` (last name is optional) or, at worst, a `4xx` validation error. The service must never crash on any input.

### Actual
The controller evaluates `lastName.length` on `undefined` **outside** the `try/catch`:

```js
// backend/src/controllers/userController.js:21
if (firstName.length > 50 || lastName.length > 50) { ... }
```

This throws a synchronous `TypeError: Cannot read properties of undefined (reading 'length')`, which is an
unhandled exception in Express. **The entire Node process exits** — the API goes down for *all* users until it is
manually restarted. Confirmed: the request returns `socket hang up` and the server log shows the process crashing at
`userController.js:21`.

### Impact
Any authenticated API consumer (integration, script, or attacker) can take the whole backend offline for **all**
users with a single well-formed HTTP request. An unhandled exception on optional input is a serious robustness/
availability defect regardless of which client triggers it — this is the highest-priority fix. (Severity kept at
Critical for the availability risk, with the accurate note that the shipped UI does not trigger it.)

### Suggested fix
Guard the optional field and move validation inside the try/catch, e.g.
`if (firstName.length > 50 || (lastName && lastName.length > 50))`, and default `lastName` to `""`.

---

## BUG-05 — Search with a regex metacharacter throws a 500 🟠 High

**Endpoint:** `GET /api/entries/search?text=(`
**Type:** Unhandled exception / regex injection

### Steps to reproduce
1. Log in.
2. Search (UI search box or API) for a single `(` — or any unbalanced regex token such as a trailing `\`.

### Expected
The punctuation is treated as a **literal** search term → `200 OK` with matching/no entries.

### Actual
The raw query is passed straight into a MongoDB `$regex`:

```js
// backend/src/controllers/entryController.js
{ title: { $regex: queryText, $options: "i" } }
```

MongoDB rejects the invalid pattern (`Regular expression is invalid: missing closing parenthesis`) and the endpoint
returns `500`. Users legitimately search for text containing `(`, `)`, `[`, `*`, `\`, etc.

### Impact
Common punctuation in a search box crashes the request. It is also a **regex-injection** vector (e.g. a
catastrophic-backtracking pattern could be used for ReDoS).

### Suggested fix
Escape the user input before building the regex (`text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) or use a MongoDB text
index.

---

## BUG-04 — Malformed entry id returns 500 instead of 4xx 🟡 Medium

**Endpoint:** `GET /api/entries/:id` (also `PATCH`/`DELETE`)

**Repro:** Log in, then `GET /api/entries/not-a-valid-objectid`.
**Expected:** `400 Bad Request` (or `404`).
**Actual:** Mongoose raises a `CastError` for the invalid `ObjectId`, surfaced as `500 Something went wrong`.
**Fix:** Validate `mongoose.isValidObjectId(id)` up front and return `400`/`404`.

---

## BUG-02 — Signup without an email returns 500 instead of 400 🟡 Medium

**Endpoint:** `POST /api/auth/signup`

**Repro:** `POST /api/auth/signup` with `{ "firstName": "X", "password": "Passw0rd!" }` (no `email`).
**Expected:** `400 "Fill all required fields!"` (the same guard the endpoint already has for other fields).
**Actual:** `email.trim().toLowerCase()` runs **before** the required-field check, throwing on `undefined` → `500`.
**Fix:** Null-check `email` before calling string methods, or reorder the validation.

---

## BUG-03 — Login with an empty body returns 500 instead of 400 🟡 Medium

**Endpoint:** `POST /api/auth/login`

**Repro:** `POST /api/auth/login` with an empty body `{}`.
**Expected:** `400`/`401` with a clear "credentials required" message.
**Actual:** `email.trim()` throws on `undefined`; the catch block masks it as `500 Something went wrong`.
**Fix:** Validate presence of `email`/`password` first and return `400`.

---

## BUG-06 — Invalid `mood` value returns 500 instead of 422 🟢 Low

**Endpoint:** `POST /api/entries`

**Repro:** Create an entry with `mood: "not-an-emoji"` (only `🙂/😔/😡` are allowed).
**Expected:** `422` validation error, consistent with the title/content/date checks.
**Actual:** Mongoose enum validation throws at save time → `500`. (Hard to hit from the UI because the mood is a
constrained `<select>`, but trivially reachable via the API.)
**Fix:** Validate `mood` against the allowed set in the controller before saving.

---

## BUG-09 — Search server-error shows a misleading empty state 🟢 Low (UX)

**Area:** Frontend (`pages/Entries.jsx`)

**Repro (verified live in the UI):** As a user **who has entries**, type `(` in the search box and submit (this triggers
BUG-05's 500). Reproduced with BrowserOS — screenshot evidence: the user's real entry is present, yet the page renders
*"Welcome, {name} — It looks like you haven't added any entries yet."*
**Expected:** An error message ("something went wrong, try a different search").
**Actual:** The query error leaves `searchResult` undefined, so the page falls through to the "haven't added any entries
yet" state — telling a user with entries that they have none.
**Fix:** Render an explicit error state when the search query errors.

---

## BUG-10 — Auth cookie is `Secure; SameSite=None` 🟢 Low (config / testability)

**Area:** Backend (`utils/generateToken.js`)

**Observation:** The token cookie is always issued with `Secure: true; SameSite: "None"`. Over plain HTTP this makes
the cookie unusable by non-browser HTTP clients (superagent/axios cookie jars refuse to replay `Secure` cookies over
HTTP), and it would break any non-HTTPS deployment. Browsers only accept it locally because `localhost` is treated as
a secure context.
**Impact:** Fragile across environments; complicates API testing (worked around in the suite by threading the
`Set-Cookie` value manually).
**Fix:** Make cookie flags environment-aware (`secure` only in production/HTTPS; `sameSite: "Lax"` for same-site setups).

---

## Minor observations (not filed as separate bugs)
- The entry **Title** field has no client-side `maxlength`; a user can type >20 chars and is only told after submitting.
- The Home CTA ("Get Started" / "Go to Your Entries") links to `/entries` even when logged out, which immediately
  redirects to `/login`.
- Password fields have no strength hint; the "strong password" rule (upper+lower+number+symbol, 8+) is only revealed on
  a failed submit.

---

## Investigated — not defects

During exploratory testing I suspected two additional issues from reading the code, then **verified them against the
running app (Playwright isolated contexts + live UI via BrowserOS) and confirmed both work correctly.** They are
recorded here for transparency:

| Suspected issue | Verdict | Evidence |
|-----------------|---------|----------|
| Session is lost on page reload / new tab (no rehydration) | ✅ **Not a bug** | `components/Layout.jsx` calls `GET /users/me` (`useProfileQuery`) on mount and rehydrates the store. A cold-loaded `/entries` in a fresh browser context with a valid cookie **stays logged in** (verified). |
| Profile name change doesn't update the navbar until re-login | ✅ **Not a bug** | `updateProfile` invalidates the `User` RTK tag → `Layout`'s `useProfileQuery` refetches → the store re-hydrates. After editing the first name, the navbar updates **immediately without a reload** (verified). |

_Lesson recorded: both false positives came from reading controllers/slices in isolation and missing `Layout.jsx`'s
rehydration. Driving the real UI is what caught them — which is exactly why the exploratory pass is done against a live
instance, not just from source._

# Agentic QA Flow with BrowserOS

## What this is

Alongside the deterministic regression suites (Playwright E2E + Jest/Supertest API), this project uses an **agentic
exploratory + triage layer** driven by **BrowserOS** (an AI-controllable browser exposed over MCP). Where the scripted
suites answer *"do the known flows still work?"*, the BrowserOS layer answers *"what breaks when a real user does
something we didn't script?"* — and then routes confirmed findings straight into the tracker with a root cause.

It is a **complement, not a replacement**. Scripted tests are the safety net that runs on every commit/CI; the agentic
pass is the exploratory tester that pokes at edges, verifies findings against the live app, and files tickets.

## The loop

```
        ┌─────────────────────────────────────────────────────────────┐
        │  1. DRIVE      navigate + act on the real UI (accessibility  │
        │                tree / screenshots — no brittle CSS selectors)│
        │  2. OBSERVE    snapshot + screenshot the resulting state     │
        │  3. VERIFY     reproduce against the running app; cross-check │
        │                the API + server logs (is it really a bug?)   │
        │  4. ROOT-CAUSE map the symptom to the offending code path    │
        │  5. FILE       open a ClickUp / Jira ticket with severity,    │
        │                repro, root cause, fix, and screenshot evidence│
        └─────────────────────────────────────────────────────────────┘
```

## Why it is low-maintenance

- **Semantic targeting, not brittle selectors.** The agent acts on the accessibility tree / visual layout, so a
  reworked class name or moved element doesn't break it the way a hard-coded `.css-1x2y3` selector would.
- **Self-describing failures.** Findings come with a screenshot + the exact reproduction the agent performed, so a
  developer can replay them without reverse-engineering a selector chain.
- **Verification built in.** A finding is only filed after it's reproduced against the live app (and, where relevant,
  cross-checked at the API layer) — which stops false positives from ever reaching the tracker.

## Proof it works — results from this project

Running this exact loop against DayBook produced real, load-bearing outcomes:

| Finding | What the agentic pass did | Outcome |
|---------|---------------------------|---------|
| **BUG-01** (server crash) | Signed up a real user with no last name via the UI, opened Profile → Save | **Corrected the report's scope**: the UI sends `lastName: ""` (safe); the crash is **API-only** (omitted field). Prevented a wrong repro from shipping. |
| **BUG-05 / BUG-09** (search 500 + misleading empty state) | Searched `(` as a user *with* an entry | **Confirmed live** with a screenshot: the app says "you haven't added any entries yet" while an entry exists. |
| **"Session lost on reload"** (suspected) | Cold-loaded `/entries` in a fresh browser context with a valid cookie | **Dismissed as NOT a bug** — `Layout.jsx` rehydrates via `GET /users/me`. |
| **"Navbar stale after profile edit"** (suspected) | Edited the first name, watched the navbar without reloading | **Dismissed as NOT a bug** — RTK `User`-tag invalidation refetches and updates it. |

> Two suspected issues (read from the source) were **caught and dismissed** by driving the real UI, and one confirmed
> bug had its reproduction **corrected**. That is the entire value proposition: the agentic layer keeps the bug report
> honest.

## Auto-triage to ClickUp / Jira (with root cause)

Because BrowserOS runs over MCP, the same session that finds a bug can open the ticket. Each confirmed finding is
turned into a structured issue — here is the payload the flow produces for the headline bug:

```yaml
title: "[Critical] PUT /api/users/me crashes the entire Node process when lastName is omitted"
severity: Critical (availability / DoS)
component: backend/src/controllers/userController.js
steps_to_reproduce:
  - Authenticate to obtain the token cookie
  - PUT /api/users/me  with body { "firstName": "X" }   # no lastName key
  - Server process exits (socket hang up); all users are down until restart
expected: 200 (lastName is optional) or a 4xx — never a crash
actual: uncaught TypeError `lastName.length` (undefined) OUTSIDE try/catch → process exit
root_cause: >
  userController.js:21 reads `lastName.length` before any null check and outside
  the try/catch. An omitted optional field is undefined, so the throw is unhandled
  and terminates the process.
suggested_fix: "if (firstName.length > 50 || (lastName && lastName.length > 50)) { ... }  // default lastName to ''"
evidence: browseros-screenshot + server crash log (userController.js:21)
verified: true (reproduced live; server PID confirmed gone)
```

**Automatic card creation — gated only on tracker access.** When a ClickUp or Jira workspace is connected (over MCP),
this final step runs **automatically**: the flow posts the payload above as a new bug card — title, severity, steps,
root cause, suggested fix, and the screenshot evidence — with no manual copy-paste. The detection → verification →
root-cause work is identical whether or not a tracker is attached; only the last "create card" call needs credentials.

For **this assessment we intentionally did not wire live ClickUp/Jira access**, so the cards are shown here as the exact
structured payload the flow would post. Grant the integration access to the bug board and the same run that finds a
verified bug will file the card for it end to end — automatically.

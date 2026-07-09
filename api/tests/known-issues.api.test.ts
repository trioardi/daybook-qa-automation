/**
 * API tests — KNOWN DEFECTS (executable bug documentation)
 * ---------------------------------------------------------------------------
 * Each test below asserts the *correct* behaviour a robust REST API should
 * exhibit. Because the current DayBook backend does NOT yet behave correctly,
 * these are marked `test.failing`: Jest reports them GREEN precisely because the
 * assertion currently fails. The day a defect is fixed, its `test.failing` will
 * start FAILING — a built-in reminder to flip it back to a normal `test`.
 *
 * Full reproduction steps, impact and suggested fixes live in docs/BUG-REPORT.md.
 * IDs below map 1:1 to that report.
 * ---------------------------------------------------------------------------
 */
import { api, signupAndAuth, uniqueUser } from '../support/client';

// BUG-02 — signup with a missing email should be a client error (400/422),
// but the controller dereferences `email.trim()` before validating, so it
// returns 500 "Something went wrong".
test.failing('BUG-02 - signup without email should return 400, not 500', async () => {
  const res = await api()
    .post('/api/auth/signup')
    .send({ firstName: 'NoEmail', password: 'Passw0rd!' });
  expect(res.status).toBe(400);
});

// BUG-03 — login with an empty body should be a 400, but `email.trim()` throws
// first and the catch block masks it as a 500.
test.failing('BUG-03 - login with empty body should return 400, not 500', async () => {
  const res = await api().post('/api/auth/login').send({});
  expect(res.status).toBe(400);
});

// BUG-04 — a malformed ObjectId should yield 400/404, but the raw Mongoose
// CastError surfaces as a 500.
test.failing('BUG-04 - GET /entries/:id with a malformed id should be 4xx, not 500', async () => {
  const { cookie } = await signupAndAuth();
  const res = await api().get('/api/entries/not-a-valid-objectid').set('Cookie', cookie);
  expect(res.status).toBeLessThan(500);
});

// BUG-05 — special regex characters in the search term are passed straight into
// a MongoDB $regex, so an unbalanced "(" (or a trailing "\") crashes the query
// with a 500 instead of being treated as a literal search.
test.failing('BUG-05 - search with a regex metacharacter should not 500', async () => {
  const { cookie } = await signupAndAuth();
  const res = await api().get('/api/entries/search').query({ text: '(' }).set('Cookie', cookie);
  expect(res.status).toBeLessThan(500);
});

// BUG-06 — an out-of-enum mood is rejected by Mongoose at save time, surfacing
// as a 500. A 422 validation error (consistent with the other field checks)
// would be correct.
test.failing('BUG-06 - creating an entry with an invalid mood should be 422, not 500', async () => {
  const { cookie } = await signupAndAuth();
  const res = await api()
    .post('/api/entries')
    .set('Cookie', cookie)
    .send({
      date: new Date().toISOString().slice(0, 10),
      title: 'MoodTest',
      mood: 'not-an-emoji',
      content: 'content',
    });
  expect(res.status).toBe(422);
});

// BUG-01 (CRITICAL) — PUT /api/users/me with the `lastName` key OMITTED
// evaluates `lastName.length` on `undefined` OUTSIDE the try/catch. The
// resulting TypeError is an unhandled synchronous throw that CRASHES the entire
// Node process, taking the API down for every user until it is restarted.
//
// Verified trigger:  { firstName: "X" }          -> server crash
//         and NOT:    { firstName: "X", lastName: "" } -> 200 OK (this is what
//         the shipped UI always sends, so a normal user cannot hit it — only
//         direct API consumers that omit the field can).
//
// This test is intentionally SKIPPED: running it live would kill the shared
// server and fail the rest of the suite. It is documented here so the repro is
// versioned alongside the tests, and is the headline item in BUG-REPORT.md.
//
// Manual repro:
//   1. Sign up / log in a user.
//   2. PUT /api/users/me  {"firstName":"OnlyFirst"}   (note: no lastName key)
//   3. Observe: request hangs / socket hang up; server logs a TypeError at
//      userController.js:21 and the process exits.
test.skip('BUG-01 - PUT /users/me without lastName must not crash the server', async () => {
  const { cookie } = await signupAndAuth(uniqueUser());
  const res = await api()
    .put('/api/users/me')
    .set('Cookie', cookie)
    .send({ firstName: 'OnlyFirst' }); // no lastName
  // A correct API returns 200 (lastName optional) or a 4xx — never a crash.
  expect(res.status).toBeLessThan(500);
});

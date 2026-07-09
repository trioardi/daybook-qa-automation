/**
 * Shared helpers for the API suite.
 *
 * WHY: centralises the three things every API test needs — a Supertest client
 * bound to the running backend, unique throwaway test data (so tests are
 * parallel-safe against a shared DB), and auth-cookie handling. The cookie
 * handling is manual on purpose: the app issues its auth cookie as
 * `Secure; SameSite=None`, which Supertest's jar refuses to replay over plain
 * HTTP (BUG-10), so we capture `Set-Cookie` and thread it by hand.
 */
import request from 'supertest';
import type { Response } from 'supertest';

export const BASE = process.env.BACKEND_URL || 'http://localhost:3000';

/** A supertest agent bound to the running DayBook backend. */
export const api = () => request(BASE);

let counter = 0;

export interface ApiUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function uniqueUser(overrides: Partial<ApiUser> = {}): ApiUser {
  counter += 1;
  // Globally unique + under the API's 50-char email limit.
  const rand = Math.random().toString(36).slice(2, 5);
  const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}${counter.toString(36)}${rand}`;
  return {
    firstName: 'Api',
    lastName: 'Tester',
    email: `api.${stamp}@daybook.test`,
    password: 'Passw0rd!',
    ...overrides,
  };
}

/**
 * Collapses a Set-Cookie response header into a single `Cookie` request header.
 *
 * NOTE: the backend issues the auth cookie with `Secure; SameSite=None`.
 * Superagent's built-in cookie jar refuses to *replay* Secure cookies over
 * plain HTTP, so we thread the cookie manually via `.set('Cookie', ...)` on
 * each authenticated call. (This Secure-over-HTTP quirk is itself documented in
 * the bug report.)
 */
export function cookieFrom(res: Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!raw || raw.length === 0) throw new Error('No Set-Cookie header on response');
  return raw.map((c) => c.split(';')[0]).join('; ');
}

/** Registers a user and returns both the user and its auth cookie. */
export async function signupAndAuth(
  overrides: Partial<ApiUser> = {}
): Promise<{ user: ApiUser; cookie: string }> {
  const user = uniqueUser(overrides);
  const res = await api()
    .post('/api/auth/signup')
    .send(user);
  if (res.status !== 201) {
    throw new Error(`signup failed ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return { user, cookie: cookieFrom(res) };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

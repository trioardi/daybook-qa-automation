/**
 * Test-data factories. Every run generates unique identities so tests are
 * fully isolated and can run in parallel against a shared database without
 * colliding on the unique `email` index.
 */

let counter = 0;

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** A brand-new, unique user that satisfies the API's strong-password rule. */
export function uniqueUser(overrides: Partial<TestUser> = {}): TestUser {
  counter += 1;
  // Globally unique across time (Date.now), parallel worker processes (pid) and
  // within a process (counter + random) — and short enough for the API's
  // 50-char email limit. Prevents duplicate-email races under high concurrency.
  const rand = Math.random().toString(36).slice(2, 5);
  const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}${counter.toString(36)}${rand}`;
  return {
    firstName: 'Alex',
    lastName: 'Tester',
    email: `qa.${stamp}@daybook.test`,
    // Meets validator.isStrongPassword: 8+ chars, upper, lower, number, symbol.
    password: 'Passw0rd!',
    ...overrides,
  };
}

export interface TestEntry {
  title: string;
  content: string;
  mood: string;
  moodLabel: string;
  date: string;
}

/** A valid journal entry (title <= 20 chars, content <= 1500 chars). */
export function uniqueEntry(overrides: Partial<TestEntry> = {}): TestEntry {
  counter += 1;
  const token = `Trip${Date.now()}${counter}`.slice(0, 20);
  return {
    title: token,
    content: `Today I wrote about ${token} and how the day unfolded in detail.`,
    mood: '🙂',
    moodLabel: '🙂 Happy',
    date: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
}

import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { NavBar } from '../pages/NavBar';
import { EntriesPage } from '../pages/EntriesPage';
import { registerUser } from './api';
import { uniqueUser, TestUser } from './data';

type Fixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  navBar: NavBar;
  entriesPage: EntriesPage;
  /** A freshly-registered user (created via the API for speed). */
  user: TestUser;
  /** A page whose UI session is already logged in as `user`. */
  authedPage: import('@playwright/test').Page;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  signupPage: async ({ page }, use) => use(new SignupPage(page)),
  navBar: async ({ page }, use) => use(new NavBar(page)),
  entriesPage: async ({ page }, use) => use(new EntriesPage(page)),

  user: async ({}, use) => {
    const u = uniqueUser();
    await registerUser(u);
    await use(u);
  },

  // Logs the seeded user in through the real UI, so every authenticated spec
  // also exercises the login flow end to end.
  authedPage: async ({ page, user }, use) => {
    const login = new LoginPage(page);
    const nav = new NavBar(page);
    await login.goto();
    await login.login(user);
    await nav.expectLoggedIn(user.firstName);
    await use(page);
  },
});

export { expect };

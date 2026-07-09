/**
 * @file A03-update-personal-details.spec.ts
 * @module Authentication
 * @feature Update personal details (profile)
 * @type Positive @priority Medium
 *
 * @preconditions
 * - A logged-in user (authedPage fixture).
 *
 * @workflow
 * 1. Log in (authedPage fixture)
 * 2. Open Profile from the navbar dropdown
 * 3. Change first + last name and save
 * 4. Verify the success toast confirms the update
 * 5. Verify persistence at the API level (GET /users/me reflects the new name)
 *
 * @expectedResults
 * - "Profile updated successfully!" toast is shown
 * - GET /users/me returns the updated first + last name
 *
 * @note We assert persistence at the API level (GET /users/me) as an
 *       authoritative check that the change was actually saved server-side,
 *       independent of any UI caching.
 */
import { test, expect } from '../../support/fixtures';
import { authedApi } from '../../support/api';

test('A03 - user can update their first and last name', async ({ authedPage, navBar, user }) => {
  const newFirst = 'Erica';
  const newLast = 'Updated';

  await navBar.updateProfile(user.firstName, { firstName: newFirst, lastName: newLast });

  await expect(authedPage.getByText('Profile updated successfully!')).toBeVisible();

  // Confirm the change actually persisted server-side.
  const api = await authedApi(user);
  const res = await api.get('/api/users/me');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data).toMatchObject({ firstName: newFirst, lastName: newLast });
  await api.dispose();
});

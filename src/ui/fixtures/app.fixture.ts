import { test as base } from 'playwright-bdd';
import { LoginPageObject } from '../pages/login';
import { SharedContext } from '../shared';
import type { AppFixtures } from '../types';

export const test = base.extend<AppFixtures>({
  sharedContext: async ({}, use) => {
    const ctx = new SharedContext();
    await use(ctx);
    ctx.clear();
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPageObject(page));
  },
});

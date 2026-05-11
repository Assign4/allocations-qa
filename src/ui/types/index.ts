import type { Page } from '@playwright/test';
import type { SharedContext } from '../shared';
import type { LoginPageObject } from '../pages/login';

export type AppFixtures = {
  sharedContext: SharedContext;
  loginPage: LoginPageObject;
};

export type BddWorld = {
  page: Page;
} & AppFixtures;

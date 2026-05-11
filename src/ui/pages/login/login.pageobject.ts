import type { Page } from '@playwright/test';
import { BasePageObject } from '../../base/base.pageobject';

const SELECTORS = {
  emailInput: '#email',
  loginButton: 'button[type="submit"]',
  verificationHeading: 'h2:has-text("Verification")',
  otpInput: 'input[data-input-otp="true"]',
  verifyButton: 'button:has-text("Verify Code")',
  dashboardIndicator: '//span[text()="Dashboard"]',
} as const;

export class LoginPageObject extends BasePageObject {
  constructor(page: Page) {
    super(page);
  }

  async navigateToLogin(): Promise<void> {
    await this.goto('/');
  }

  async submitEmail(email: string): Promise<void> {
    await this.waitForAndFill(SELECTORS.emailInput, email);
    await this.waitForAndClick(SELECTORS.loginButton);
  }

  async waitForVerificationPage(): Promise<void> {
    await this.waitForVisible(SELECTORS.verificationHeading);
  }

  async submitOtp(otp: string): Promise<void> {
    await this.waitForAndType(SELECTORS.otpInput, otp);
    await this.page.waitForLoadState()
  }

  async isLoggedIn(): Promise<void> {
    await this.waitForURL(/\/(?!$)/);
    await this.waitForVisible(SELECTORS.dashboardIndicator);
  }
}

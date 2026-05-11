import { expect, Locator, Page } from '@playwright/test';

export abstract class BasePageObject {
  constructor(protected readonly page: Page) {}

  protected locator(selector: string, nth = 0): Locator {
    return this.page.locator(selector).nth(nth);
  }

  async waitForAndClick(selector: string, nth = 0): Promise<void> {
    const el = this.locator(selector, nth);
    await el.waitFor({ state: 'visible' });
    await el.click();
  }

  async waitForAndFill(selector: string, value: string, nth = 0): Promise<void> {
    const el = this.locator(selector, nth);
    await el.waitFor({ state: 'visible' });
    await el.fill(value);
  }

  async waitForAndClear(selector: string, nth = 0): Promise<void> {
    const el = this.locator(selector, nth);
    await el.waitFor({ state: 'visible' });
    await el.clear();
  }

  async waitForAndType(selector: string, text: string): Promise<void> {
    const el = this.locator(selector);
    await el.waitFor({ state: 'visible' });
    await el.click();
    await this.page.keyboard.type(text);
  }

  async waitForURL(pattern: string | RegExp): Promise<void> {
    await this.page.waitForURL(pattern);
  }

  async waitForText(selector: string, text: string): Promise<void> {
    await expect(this.locator(selector)).toContainText(text);
  }

  async waitForVisible(selector: string): Promise<void> {
    await this.locator(selector).waitFor({ state: 'visible' });
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.locator(selector).isVisible();
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}

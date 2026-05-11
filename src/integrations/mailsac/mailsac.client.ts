import { randomBytes } from 'crypto';
import type { MailsacClientOptions, MailsacMessage } from './types';

const MAILSAC_BASE = 'https://mailsac.com/api';
const OTP_PATTERN = /\b\d{6}\b/;

export class MailsacClient {
  private readonly apiKey: string;
  private readonly pollIntervalMs: number;
  private readonly maxWaitMs: number;

  constructor(options: MailsacClientOptions) {
    this.apiKey = options.apiKey;
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
    this.maxWaitMs = options.maxWaitMs ?? 30_000;
  }

  generateEmail(): string {
    return `test-${randomBytes(6).toString('hex')}@mailsac.com`;
  }

  async waitForOtp(email: string): Promise<string> {
    const deadline = Date.now() + this.maxWaitMs;
    while (Date.now() < deadline) {
      const otp = await this.extractLatestOtp(email);
      if (otp) return otp;
      await this.sleep(this.pollIntervalMs);
    }
    throw new Error(`No OTP received at ${email} within ${this.maxWaitMs}ms`);
  }

  async deleteAllMessages(email: string): Promise<void> {
    await this.fetch(`/addresses/${email}/messages`, { method: 'DELETE' });
  }

  private async extractLatestOtp(email: string): Promise<string | null> {
    const messages = await this.getMessages(email);
    if (!messages.length) return null;
    const body = await this.getMessageText(email, messages[0]._id);
    const match = body.match(OTP_PATTERN);
    return match?.[0] ?? null;
  }

  private async getMessages(email: string): Promise<MailsacMessage[]> {
    return this.fetch<MailsacMessage[]>(`/addresses/${email}/messages`);
  }

  private async getMessageText(email: string, messageId: string): Promise<string> {
    return this.fetch<string>(`/text/${email}/${messageId}`);
  }

  private async fetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await globalThis.fetch(`${MAILSAC_BASE}${path}`, {
      ...init,
      headers: {
        'Mailsac-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Mailsac request failed: ${response.status} ${path}`);
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { spec } from 'pactum';

class AuthHelper {
  async sendLoginOtp(email: string): Promise<void> {
    await spec('send login otp', { email });
  }

  async verifyOtp(email: string, otp: string): Promise<void> {
    await spec('verify login otp', { email, token: otp });
  }
}

export const authHelper = new AuthHelper();

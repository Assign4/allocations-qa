import * as dotenv from 'dotenv';
import { Given, Then, When } from '@cucumber/cucumber';
import { MailsacClient } from '../../integrations/mailsac';
import { authHelper } from '../helpers/auth.helper';
import { logger } from '../utils';

dotenv.config();

const mailsac = new MailsacClient({ apiKey: process.env.MAILSAC_API_KEY ?? '' });

let testEmail: string;
let capturedOtp: string;

Given('the allocations API is ready', () => {
  testEmail = mailsac.generateEmail();
  logger.info({ testEmail }, 'API test starting');
});

When('I send a login OTP request for my test email', async () => {
  await authHelper.sendLoginOtp(testEmail);
});

Then('the OTP should be delivered to my email', async () => {
  capturedOtp = await mailsac.waitForOtp(testEmail);
  logger.info({ otp: capturedOtp }, 'OTP received');
  if (!capturedOtp) throw new Error('No OTP retrieved from mailsac');
});

When('I verify the OTP via the API', async () => {
  await authHelper.verifyOtp(testEmail, capturedOtp);
});

Then('the verification should succeed', () => {
  logger.info('Auth API verification complete');
});

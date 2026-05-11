import { createBdd } from 'playwright-bdd';
import { MailsacClient } from '../../../integrations/mailsac';
import { test } from '../../fixtures';
import { ContextKey } from '../../shared';

const { Given, When, Then } = createBdd(test);

const mailsac = new MailsacClient({ apiKey: process.env.MAILSAC_API_KEY ?? '' });

Given('I am on the login page', async ({ loginPage, sharedContext }) => {
  sharedContext.set(ContextKey.EMAIL, mailsac.generateEmail());
  await loginPage.navigateToLogin();
});

When('I submit my email for login', async ({ loginPage, sharedContext }) => {
  const email = sharedContext.get<string>(ContextKey.EMAIL);
  await loginPage.submitEmail(email);
});

Then('I should see the OTP verification page', async ({ loginPage }) => {
  await loginPage.waitForVerificationPage();
});

When('I enter the OTP received in my email', async ({ loginPage, sharedContext }) => {
  const email = sharedContext.get<string>(ContextKey.EMAIL);
  const otp = await mailsac.waitForOtp(email);
  sharedContext.set(ContextKey.OTP, otp);
  await loginPage.submitOtp(otp);
});

Then('I should be successfully logged in', async ({ loginPage }) => {
  await loginPage.isLoggedIn();
});

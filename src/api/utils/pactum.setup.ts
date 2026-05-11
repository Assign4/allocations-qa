import * as dotenv from 'dotenv';
import { request } from 'pactum';
import { logger } from './logger';

dotenv.config();

export const setupPactum = (): void => {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) throw new Error('BASE_URL is not set in .env');
  request.setBaseUrl(baseUrl);
  logger.info({ baseUrl }, 'Pactum configured');
};
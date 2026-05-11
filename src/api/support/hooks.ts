import { BeforeAll } from '@cucumber/cucumber';
import '../specs/auth.spec.handler';
import { setupPactum } from '../utils';

BeforeAll(async () => {
  setupPactum();
});

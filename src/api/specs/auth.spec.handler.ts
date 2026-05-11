import { handler, stash } from 'pactum';

handler.addSpecHandler('send login otp', ({ spec, data }) => {
  const { email } = data as { email: string };
  spec.post('/api/auth/login');
  spec.withHeaders({ 'content-type': 'application/json', accept: 'application/json' });
  spec.withJson({ email });
  spec.expectStatus(200);
  stash.addDataStore({ TEST_EMAIL: email });
});

handler.addSpecHandler('verify login otp', ({ spec, data }) => {
  const { email, token } = data as { email: string; token: string };
  spec.post('/api/auth/verify');
  spec.withHeaders({ 'content-type': 'application/json', accept: '*/*' });
  spec.withJson({ email, token, type: 'email' });
  spec.expectStatus(200);
});

# allocations-qa

End-to-end and API test suite for [dashboard.allocations.com](https://dashboard.allocations.com), built with Playwright, playwright-bdd, and Cucumber.

## Tech Stack

| Layer | Tool |
|-------|------|
| Test runner | [Playwright](https://playwright.dev/) |
| BDD framework | [playwright-bdd](https://vitalets.github.io/playwright-bdd/) |
| API testing | [Pactum](https://pactumjs.github.io/) + [Cucumber](https://cucumber.io/) |
| Language | TypeScript |
| Email integration | [Mailsac](https://mailsac.com/) (OTP verification) |
| Logging | Pino |

## Project Structure

```
src/
├── ui/
│   ├── features/        # Gherkin feature files (UI)
│   ├── pages/           # Page Objects + BDD step helpers
│   ├── fixtures/        # Playwright fixtures
│   ├── shared/          # Shared context utilities
│   └── base/            # Base page object
└── api/
    ├── features/        # Gherkin feature files (API)
    ├── steps/           # Cucumber step definitions
    ├── specs/           # API spec handlers
    ├── helpers/         # Auth helpers
    ├── utils/           # Pactum setup, logger
    └── support/         # Cucumber hooks
```

## Test Coverage

### UI Tests (Playwright BDD)
- **Login** — Email OTP login flow with real inbox verification via Mailsac

### API Tests (Cucumber + Pactum)
- **Auth** — OTP request, email delivery assertion, OTP verification

## Setup

```bash
npm install
npx playwright install chromium
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Target environment URL |
| `TEST_EMAIL` | Email address used for OTP login tests |
| `MAILSAC_API_KEY` | [Mailsac](https://mailsac.com/) API key for inbox polling |

## Running Tests

```bash
# UI tests (Playwright BDD)
npm run test:ui

# API tests (Cucumber)
npm run test:api

# Generate BDD step stubs only
npm run bddgen

# Lint
npm run lint

# Type check
npm run typecheck
```

## Reports

After running UI tests, an HTML report is generated at `reports/ui/index.html`.

# Business Module Testing Conventions

## Scope
Applies to `src/business/**` modules.

## Unit tests (`<name>.spec.ts`)
- Co-located with the source file (same folder).
- Pure/unit-level only: mock ports/repositories/adapters; **no DB, no broker, no cache/Redis, no storage, no Nest app bootstrap, no outbox side effects**.
- Discovered by default Jest config (`npm test` / `npm run test:unit`).

## Component tests (`<name>.spec.ts`)
- Co-located with the source (controllers/facades).
- Use `Test.createTestingModule` with mocked dependencies; no real IO.
- Discovered by default Jest config.

## Integration tests (`<name>.integration-spec.ts`)
- For tests with side effects: Prisma/`TransactionHost`, outbox writes, messaging, Redis/cache, file storage, HTTP/Nest integration bootstrap, or multi-adapter flows.
- Location: `src/business/<context>/<module>/specifications/integrations/` (preferred) or `specifications/` (legacy).
- Naming: `<name>.integration-spec.ts`.
- Discovered by `jest.business-integration.config.ts` (`npm run test:integration:business`), run with `--runInBand`.

## API tests (`<name>.api-spec.ts`)
- Location: `src/business/<context>/<module>/specifications/api/`.
- HTTP/Nest bootstrap tests hitting endpoints; run with `npm run test:integration:business`.

## Contract tests (`<name>.contract.spec.ts`)
- Location: `src/business/<context>/<module>/contracts/`.
- Verify public REST/module contracts (Pact or OpenAPI snapshots).

## Security tests (`<name>.security.spec.ts`)
- Location: `src/business/<context>/<module>/specifications/security/`.
- Discovered by the integration Jest config (`npm run test:integration:business`).
- Verify tenant scoping (404 not 403), RBAC/ABAC, injection, rate limits.

## Classification rule
- If a test exercises real infrastructure/IO or transactional side effects, it is an integration test and must live under `specifications/`.
- If it can be fully isolated with mocks/fakes and no external side effects, it is a unit/component test and must be co-located with the source.

## E2E
- Not used. API-level coverage is provided by component/integration/security tests.

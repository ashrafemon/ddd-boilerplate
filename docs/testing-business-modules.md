# Business Module Testing Conventions

## Scope
Applies to `src/business/**` modules.

## Unit tests (`<name>.spec.ts`)
- Co-located with the source file (same folder), e.g.:
  - `domain/aggregates/<name>.spec.ts`
  - `application/use-cases/<verb>-<noun>.usecase.spec.ts`
- Pure/unit-level only: mock ports/repositories/adapters; **no DB, no broker, no cache/Redis, no storage, no Nest app bootstrap, no outbox side effects**.
- Discovered by default Jest config (`npm test` / `npm run test:unit`).

## Integration tests (`<name>.integration-spec.ts`)
- For tests with side effects: Prisma/`TransactionHost`, outbox writes, messaging, Redis/cache, file storage, HTTP/Nest integration bootstrap, or multi-adapter flows.
- Location: `src/business/<context>/<module>/specifications/`, mirroring the module's internal folder structure where useful.
  - Example: `src/business/procurement/purchase-order/specifications/application/use-cases/create-purchase-order.integration-spec.ts`
- Naming: `<name>.integration-spec.ts`.
- Discovered by `jest.business-integration.config.ts` (`npm run test:integration:business`), run with `--runInBand`.

## Classification rule
- If a test exercises real infrastructure/IO or transactional side effects, it is an integration test and must live under `specifications/`.
- If it can be fully isolated with mocks/fakes and no external side effects, it is a unit test and must be co-located with the source.

## Migration
- Existing/misplaced unit tests in `src/business` should be moved to co-located `*.spec.ts`.
- Side-effecting tests must be moved/rewritten as `specifications/**/*.integration-spec.ts`.

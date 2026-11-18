# Testing Conventions

## Scope

Every module under `src/` — `src/business/**` and `src/platform/**` alike. There is **no root
`test/` folder**: cross-cutting suites, shared fakes and helpers live in `src/specifications/`.
The rules are enforced by `src/specifications/architecture/test-layout.spec.ts`
(`npm run test:architecture`).

## Placement

A test lives in exactly one of two places: **beside the file it tests**, or in the module's
`specifications/` folder.

| Kind        | Location                       | Suffix                 | Runner                        |
| ----------- | ------------------------------ | ---------------------- | ----------------------------- |
| Unit        | beside the source file         | `.spec.ts`             | `npm test`                    |
| Component   | `specifications/components/`   | `.component-spec.ts`   | `npm run test:specifications` |
| Integration | `specifications/integrations/` | `.integration-spec.ts` | `npm run test:specifications` |
| API         | `specifications/api/`          | `.api-spec.ts`         | `npm run test:specifications` |
| Contract    | `specifications/contracts/`    | `.contract.spec.ts`    | `npm run test:specifications` |
| Security    | `specifications/security/`     | `.security.spec.ts`    | `npm run test:specifications` |
| Property    | `specifications/properties/`   | `.property-spec.ts`    | `npm run test:specifications` |

```
<module>/
├── use-cases/reserve-idempotency.usecase.ts
├── use-cases/reserve-idempotency.usecase.spec.ts      ← unit, beside the file
└── specifications/
    ├── api/idempotency-interceptor.api-spec.ts
    ├── integrations/idempotency-claim.integration-spec.ts
    ├── contracts/...
    ├── components/...
    ├── security/...
    └── properties/idempotency-cache-key.property-spec.ts
```

A module's `specifications/` holds only those six folders and nothing else — no unit tests, no
nested folders, no `__tests__`.

## Project-level specifications

`src/specifications/` is the only specifications folder that is not part of a module. It holds the
cross-cutting suites and the shared test doubles, so module source stays free of fakes:

| Folder          | Holds                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| `architecture/` | boundary, shape and layout suites (`npm run test:architecture`)                      |
| `support/`      | in-memory repositories, fakes, faker factories (`@test/support/...`)                 |
| `utils/`        | helpers such as `create-test-app.ts`, `noop-transaction-host.ts` (`@test/utils/...`) |
| `data/`         | static fixtures that are not generated                                               |

A `*.fakes.ts` file inside module source fails the layout test.

## Classification rule

- **Mocks or fakes only, no IO** → unit test, beside the source. Includes pure guards/adapters
  that only compare booleans.
- **Real IO** (Prisma/`TransactionHost`, Redis/cache, broker, storage) **or a real HTTP boot**
  (`FastifyAdapter` + `app.init()`) → `specifications/`.
- `specifications/components/` is for a real Nest DI graph with all IO faked; use it when wiring
  is the thing under test.
- Never call `module.search`-style helpers or reach into the container from a unit test.

## Unit tests (`<name>.spec.ts`)

- Co-located with the source file (same folder).
- Mock ports/repositories/adapters; **no DB, no broker, no cache/Redis, no storage, no app
  bootstrap, no outbox side effects**.
- Discovered by the default Jest config (`npm test` / `npm run test:unit`), which ignores
  `specifications/` and `*.integration-spec.ts`.
- Every source file that holds logic is expected to have one. Missing coverage is tracked per
  phase, never "later" inside the same module.

## Integration tests (`<name>.integration-spec.ts`)

- For side effects: Prisma/`TransactionHost`, outbox writes, messaging, Redis/cache, storage, or
  multi-adapter flows.
- `specifications/integrations/` (flat, one level).
- Proves the invariant, not the happy path only: concurrency, leases, CAS fencing, idempotent
  replays.
- Build the smallest module that carries the graph under test; when a client owns a connection
  pool, `init()` the module so `close()` runs its destroy hooks.

## API tests (`<name>.api-spec.ts`)

- `specifications/api/`; real Nest + `FastifyAdapter` boot, `supertest` against
  `app.getHttpServer()`.
- Assert status codes and response bodies of the HTTP contract (validators, interceptors,
  filters), not controller internals.

## Contract tests (`<name>.contract.spec.ts`)

- `specifications/contracts/`; response DTO shapes, cross-module public contracts, webhook/event
  payload envelopes.
- A change that breaks a consumer must fail here before it reaches integration.

## Security tests (`<name>.security.spec.ts`)

- `specifications/security/`; tenant scoping (foreign row = 404, never 403), RBAC/ABAC fail-closed
  behaviour, injection, rate limits.

## Fixtures and generators

- **faker** (`@faker-js/faker`) builds seed and fixture data. Factories live in
  `src/specifications/support/factories/`, one file per aggregate, and are shared by
  `prisma/seed.ts` and tests. Always call `seedFaker()` first: a fixed seed is what makes a seed
  run reproducible and an integration assertion stable. Identities stay deterministic
  (`sequenceCode('SKU', 3)` → `SKU-0004`); only descriptive values are random.
- **fast-check** drives property tests (`specifications/properties/`). Use it where the input
  space is wide and the invariant is simple — keys, identities, hashes, ordering, serialisation.
  A property that never fails is usually a weak generator: give it a hostile alphabet (the key
  separator itself, `%`, empty strings) and expect it to find something.

## Runners

| Script                                 | Scope                                |
| -------------------------------------- | ------------------------------------ |
| `npm test` / `npm run test:unit`       | every co-located `*.spec.ts`         |
| `npm run test:integration:business`    | `src/business/**/specifications/**`  |
| `npm run test:specifications:platform` | `src/platform/**/specifications/**`  |
| `npm run test:specifications`          | both of the above                    |
| `npm run test:architecture`            | `src/specifications/architecture/**` |

`specifications` runners use `--runInBand` because they share the real database.

## E2E

Not used. API-level coverage is provided by api + integration + security specifications.
End-to-end specs, when introduced, are `<flow>.e2e-spec.ts` beside the module and run with
`npm run test:e2e` (`jest.e2e.config.ts`).

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

## Component tests (`<name>.component-spec.ts`)

- `specifications/components/`; **Nest builds the module's real provider graph**, every IO edge
  faked. Use it when the wiring is the subject: `useExisting`/`useFactory` bindings, public port
  tokens, constructor injection, decorators.
- Build the graph with `createComponentModule(<Module>, { overrides, platform })`
  (`@test/utils/component-module`). It replays the module's own `providers` metadata and skips the
  `imports: [PlatformModule]` edge (which would open Prisma/Redis/RabbitMQ), registering the
  platform doubles from `@test/support/platform/fake-platform-ports` instead.
- `overrides` replaces the module's IO bindings (command repository, query, outbound adapters).
  `platform` replaces a platform double — e.g. `{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }`
  to prove the fail-closed path.
- Assert on the doubles: `RecordingOutboxWriter.appended` (aggregate type/id/broker),
  `AllowAbacPort.lastCheck()` (resource/action/identity). Never assert on Prisma or HTTP here.
- A missing `provide` token, an unbound public port or a constructor injecting an unknown
  dependency fails at `compile()` — that is the class of bug unit tests cannot see.

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
- **One file per endpoint**, named after the route: `create-vendor.api-spec.ts`,
  `list-vendors.api-spec.ts`, `vendor-status.api-spec.ts`. A single `<module>.api-spec.ts` turns
  into a 500-line suite where a broken route is hard to find; per-endpoint files make the failure
  name the route, and a new endpoint adds a file instead of growing an existing one.
- Boot through `createApiTestApp({ controller, providers })`
  (`src/specifications/utils/api-test-app.ts`). It registers the global `AppValidationPipe`
  exactly as `AppModule` does, and auto-stubs the controller's other constructor dependencies so
  the spec only declares the doubles it asserts on. Without the pipe the Zod DTOs never run and
  the spec silently accepts bodies that production rejects (`PATCH /price-lists/:id/activate`
  used to assert a `reason` that the global pipe strips).
- Assert status codes and response bodies of the HTTP contract (validators, interceptors,
  filters), not controller internals.
- Cover the error paths, not just the happy ones: `400` (missing/invalid body field), `404`
  (use case rejects with `NotFoundException`), `409` (use case rejects with `ConflictException`).
- Pin replay protection by asserting the `@Idempotent()` metadata on the handlers that mutate
  state (`Reflect.getMetadata('idempotentScope', handler)`), so removing the decorator fails a
  test instead of silently losing idempotency.

## Contract tests (`<name>.contract.spec.ts`)

- `specifications/contracts/`; response DTO shapes, cross-module public contracts, webhook/event
  payload envelopes.
- A change that breaks a consumer must fail here before it reaches integration.
- The outbox wire contract is `event.constructor.name` as `eventType` (written by
  `AppendOutboxEventUseCase`) plus `eventId`, `version` and `occurredAt`. Pin the published event
  class name, its envelope fields and its payload field types, and assert the event survives
  `JSON.parse(JSON.stringify(...))` (consumers see ISO strings, not `Date`).
- Build the event through the real producer (`<Aggregate>Factory.create(...).pullEvents()`) so the
  test breaks when the aggregate stops emitting, not only when the class changes.

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

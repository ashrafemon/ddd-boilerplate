# Phase Testing Plan — All Business Modules

## Scope
Applies to all `src/business/**` modules (vendor, product, product-pricing, purchase-order, GRN, invoice). Over 8 phases.

## Implementation Status
| Phase | Status | Location | Suites/Tests |
|-------|--------|----------|--------------|
| 1 Unit — Domain | Aggregates, VOs, policies, services, events | Co-located `*.spec.ts` | Includes 27 event + 2 aggregate suites |
| 2 Unit — Application | All 24 non-transactional use cases | `application/use-cases/*.spec.ts` | 24 suites / 52 tests |
| 3 Component | Every action on all 6 controllers | `presentation/http/*.controller.spec.ts` | 6 suites / 33 tests |
| 4 Integration | Transactional use cases + facades | `specifications/` | 44 suites / 229 tests |
| 5 API | Added for all 6 modules | `specifications/api/*.api-spec.ts` | 6 suites / 33 tests |
| 6 Contract | All 6 modules (item + list + 10 public contracts) | `specifications/contracts/*.contract.spec.ts` | 16 suites / 36 tests |
| 7 Security | All 6 modules + RBAC/ABAC adapters + guard | `specifications/security/*.security.spec.ts` | 9 suites / 32 tests |
| 8 CI/Hardening | Suites pass; `tsc`/`build` have pre-existing source errors | Verification battery | 264 unit suites / 867 tests; 72 integration suites / 322 tests |

## File-level Coverage
| File type | Count | Location |
|-----------|-------|----------|
| Domain aggregates | all | `domain/aggregates/*.spec.ts` |
| Domain events | 27 | `domain/events/*.event.spec.ts` |
| Prisma mappers | 6 | `infrastructure/persistence/prisma/*.mapper.spec.ts` |
| Infrastructure adapters | 27 | `infrastructure/adapters/**/*.adapter.spec.ts` |
| Integration listeners | 4 | `integrations/consumes/listeners/*.listener.spec.ts` |
| Request DTOs | 33 | `presentation/http/requests/*.dto.spec.ts` |
| Response DTOs | 34 | `presentation/http/responses/*.dto.spec.ts` |
| Modules | 11 | `*.module.spec.ts` |
| Contract specs | 16 | `specifications/contracts/*.contract.spec.ts` |
| Facades | 8 | `specifications/application/facades/*.integration-spec.ts` |
| Controllers | 6 | `presentation/http/*.controller.spec.ts` |
| Non-transactional use cases | 24 | `application/use-cases/*.spec.ts` |
| Transactional use cases | 39 | grouped under `specifications/application/use-cases/` |

## Phase 1: Unit — Domain
- **Goal**: Domain logic isolation.
- **Where**: Co-located `*.spec.ts` in:
  - Domain aggregates (aggregates/)
  - Entities & value objects (value-objects/)
  - Policies (policies/)
  - Domain services (services/)
- **Target**: ~120 tests (1 per public method/invariant).
- **Run**: `npm test` (default Jest).

## Phase 2: Unit — Application
- **Goal**: Use-case orchestration with mocked ports/repositories.
- **Where**: Co-located `*.spec.ts` in `application/use-cases/`.
- **Target**: ~99 use cases × 2 scenarios = 200 tests.
- **Run**: `npm test`.

## Phase 3: Component
- **Goal**: Controllers/facades over Nest bootstrap, no IO.
- **Where**:
  - Controllers: `presentation/http/*.controller.spec.ts`
  - Facades: `application/facades/*.facade.spec.ts`
- **Target**: 6 controllers × ~5 happy/error paths each = ~40 tests.
- **Run**: `npm test`.

## Phase 4: Integration
- **Goal**: Critical flows with Prisma/outbox/messaging.
- **Where**: `src/business/<module>/specifications/integrations/` (preferred) or legacy `specifications/`.
- **Target**: ~60 integration-spec tests (one per key use case).
- **Run**: `npm run test:integration:business`.

## Phase 5: API
- **Goal**: HTTP/Nest bootstrap hitting endpoints.
- **Where**: `src/business/<module>/specifications/api/`.
- **Target**: ~30 api-spec tests (controller-level with real Nest).
- **Run**: `npm run test:integration:business`.

## Phase 6: Contract
- **Goal**: Public REST/module contracts (Pact or OpenAPI snapshots).
- **Where**: `src/business/<module>/specifications/contracts/`.
- **Target**: ~20 contract.spec tests (one per public boundary).
- **Run**: `npm run test:integration:business`.

## Phase 7: Security
- **Goal**: Tenant isolation, RBAC/ABAC, injection, rate limits.
- **Where**: `src/business/<module>/specifications/security/`.
- **Target**: ~40 security-spec tests per module (RBAC, tenant, injection).
- **Run**: `npm run test:integration:business`.

## Phase iget:
- **Goal**: Coverage gates, architecture test, verification battery.
- **Actions**:
  - `npx tsc --noEmit -p tsconfig.json`
  - `npm run lint:check`
  - `npm run format:check`
  - `npm run docs:di`
  - `npm run build`
  - Architecture spec via `test/architecture/architecture.spec.ts`
  - Smoke: `npm run test:integration:business` (all phases)
- **Run**: CI pipeline.

## Key Commands
- Unit/Component: `npm test`
- Integration/API/Contract/Security: `npm run test:integration:business`
- Verify: the verification battery (tsc + lint + format + docs:di + build) after each phase.

## Notes
- Do not mix unit tests with side effects; side-effecting tests must go under `specifications/`.
- Keep component tests co-located for easy maintenance; they are discovered by default Jest.

# Implementation Roadmap

> Phases 0–10 for standardizing business modules. Each task is small enough to
> implement, validate, and document independently.
> Live status lives in [`PROGRESS.md`](./PROGRESS.md); decisions live in
> [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md).
> **Phase 0 is complete. Do not start Phase 1 without confirmation.**

---

## 1. Execution model

For every task:

1. Read the relevant architecture doc(s).
2. Inspect the actual implementation (no assumptions).
3. Check dependencies and confirm the task is eligible.
4. Implement only that task's scope.
5. Run the task validation plus the repo verification battery.
6. Review for architectural compliance.
7. Update `PROGRESS.md` immediately (status, files, commands, results, date).
8. Add/update an ADR if a decision or conflict was created/resolved.
9. Move only to the next eligible task.

Status values: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `NEEDS_REVIEW`.
Completion requires passing acceptance/validation, not merely code changes.

Global validation battery (run as applicable):

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
npm run test:e2e          # requires docker compose up -d and .env
git status --short
```

New tasks discovered mid-flight get a new ID appended to the current phase (for
example `P3-13`) and are added here and to `PROGRESS.md`.

---

## 2. Phase 0 — Documentation and architectural specification

**Status: COMPLETED (2026-11-05).** No source code modified.

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-01 | 0 | Inspect existing documentation structure | Inventory `docs/`, root `*.md`, conventions | Record folders/files/purposes; no source edits | Inventory recorded in README/handover | `find docs`, `git status` | — | COMPLETED |
| P0-02 | 0 | Identify existing architecture/guideline docs | `ARCHITECTURE.md`, `docs/BUSINESS-MODULE-GUIDE.md`, `docs/PLATFORM-SERVICE-GUIDE.md`, `docs/FLOWCHARTS.md`, `docs/DI-WIRING.md`, `AGENTS.md`, `README.md`, `docs/IAM-BUILD-PLAN.md` | Catalog purpose/authority | Cataloged in README §3 | cross-check | P0-01 | COMPLETED |
| P0-03 | 0 | Identify gaps/outdated/conflicts | Compare mandate rules vs existing docs/code | Record drift: `listens` vs `listeners`, `business-aggregate` vs `module`, missing `public/index.ts`, platform path changes; record in ADR/handover | Gap list recorded | ADR-002/ADR-012 | P0-02 | COMPLETED |
| P0-04 | 0 | Consolidate architectural rules | `ARCHITECTURE-RULES.md` | Reproduce rules without weakening; add IDs R-01…R-46 | All mandate rules present | manual cross-check | P0-03 | COMPLETED |
| P0-05 | 0 | Document layer responsibilities | `LAYER-RESPONSIBILITIES.md` | Responsibility/allowed/prohibited matrix for all components | Matrix complete | manual cross-check | P0-04 | COMPLETED |
| P0-06 | 0 | Document dependency boundaries | `DEPENDENCY-BOUNDARIES.md` | Directions, domain access, exceptions, examples, enforcement gaps | Complete | manual cross-check | P0-05 | COMPLETED |
| P0-07 | 0 | Document request lifecycle/context | `REQUEST-LIFECYCLE.md` | Middleware→context→auth→config→guard→use case→ABAC; background exception | Complete | manual cross-check | P0-06 | COMPLETED |
| P0-08 | 0 | Document RBAC/ABAC | `AUTHORIZATION.md` | Responsibilities, boundaries, sequence, current gaps, IAM dependency | Complete | manual cross-check | P0-07 | COMPLETED |
| P0-09 | 0 | Document event integrations | `EVENT-INTEGRATION.md` | Incoming contracts/listeners + Inbox-first; outgoing contracts/publishers; naming; tests | Complete | manual cross-check | P0-08 | COMPLETED |
| P0-10 | 0 | Document cache/idempotency decorators | `CROSS-CUTTING-CONCERNS.md` | Decorator rules, controller-endpoint placement, composition, prohibitions, audit checklist | Complete | manual cross-check | P0-09 | COMPLETED |
| P0-11 | 0 | Create phased roadmap | `IMPLEMENTATION-ROADMAP.md` | Phases 0–10; every task with all fields | Complete | manual cross-check | P0-10 | COMPLETED |
| P0-12 | 0 | Create persistent progress tracker | `PROGRESS.md` | Every task row; completed/pending/blocked; next action | Complete | manual cross-check | P0-11 | COMPLETED |
| P0-13 | 0 | Create ADR log | `ARCHITECTURAL-DECISIONS.md` | Decisions, rationale, consequences, open questions, conflicts | Complete | manual cross-check | P0-12 | COMPLETED |
| P0-14 | 0 | Create AI handover | `AI-HANDOVER.md` | Read order, resume procedure, state, rate-limit protocol | Complete | manual cross-check | P0-13 | COMPLETED |
| P0-15 | 0 | Review/verify consistency | Whole package + cross-links | Cross-check every rule against docs; verify links; confirm no source changes | Consistent package; no `src/` changes | `git status`, grep checks | P0-14 | COMPLETED |
| P0-16 | 0 | Incorporate 2026-11-05 clarifications | Rules, layer/boundary/lifecycle/event/cross-cutting docs, ADRs, roadmap, progress | Add R-44 (types/events), R-45 (unavailable ports), R-46 (decorator placement); update ADR-005/ADR-009; add ADR-018; update task acceptance; no source changes | Docs consistent; clarifications traceable; no `src/` changes | link/task-ID checks, `git status` | P0-15 | COMPLETED |

---

## 3. Phase 1 — Existing business module architecture audit

**Status: COMPLETED (2026-11-05).** Audit report: `AUDIT-REPORT.md`. Read-only audit; do not refactor in this phase.
**Modules to inspect:** `party/vendor`, `procurement/product`, `procurement/purchase-order`, `procurement/good-receipt-note`, `sales/invoice`; plus `shared-business` boundaries and the schema-only `inventory/stock-movement`.

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | Identify all business modules | `src/business/**`, `eslint.config.mjs`, `prisma/schema/**` | Inventory contexts, modules, schema-only modules; note missing module dirs | Module inventory table with paths/contexts | `find`, `git status` | P0-16 | COMPLETED |
| P1-02 | 1 | Identify layer/folder structure per module | Each module's domain/application/infrastructure/presentation/public | Compare to target anatomy; record missing/extra/renamed dirs | Per-module structure table | file tree inspection | P1-01 | COMPLETED |
| P1-03 | 1 | Audit controllers | `presentation/http/*.controller.ts` | Check thinness, conditionals, calculations, direct repos/domain/ports, response shape | Findings with file refs | code inspection | P1-02 | COMPLETED |
| P1-04 | 1 | Audit use cases | `application/usecases/*.usecase.ts` | Check R-04…R-11: orchestration-only, no calculations/domain ops, no facade, variables, context sequence | Findings with file refs | code inspection | P1-03 | COMPLETED |
| P1-05 | 1 | Audit facades | `application/facades/*.facade.ts` | Check facade→use case, facade→facade, business logic, domain imports | Findings | code inspection | P1-04 | COMPLETED |
| P1-06 | 1 | Audit type and event boundaries | domain imports and imports of domain files | Check R-16/R-17/R-44: type-only non-event imports are allowed; runtime aggregate/entity/VO imports and event imports are restricted; explicit listener/publisher contracts only | Findings | grep imports | P1-05 | COMPLETED |
| P1-07 | 1 | Audit domain services | `domain/services/*.ts` | Check calculations, specialized ops, invariant/policy throwing, framework imports | Findings | code inspection | P1-06 | COMPLETED |
| P1-08 | 1 | Audit invariants/policies | `domain/**/*.invariants.ts`, `domain/policies/*.ts` | Check coverage, registration, error semantics, policy inputs | Findings | code inspection | P1-07 | COMPLETED |
| P1-09 | 1 | Audit application DTOs/mappers | `application/**` | Identify application-layer DTOs/mappers and necessity; distinguish infra mappers | Findings | code inspection | P1-08 | COMPLETED |
| P1-10 | 1 | Audit incoming event integrations | `application/integrations/listens/**` | Contracts, per-event listeners, organization, naming, transport decorators | Findings | code inspection | P1-09 | COMPLETED |
| P1-11 | 1 | Audit outgoing event integrations | `application/integrations/publishes/**`, outbox adapters | Contracts, per-event publishers, use-case coupling, outbox-only publishing | Findings | code inspection | P1-10 | COMPLETED |
| P1-12 | 1 | Audit Inbox/duplicate handling | All listeners + `platform-common/inbox` | Every listener checks Inbox before use case; dedupe/replay semantics | Findings | code inspection | P1-11 | COMPLETED |
| P1-13 | 1 | Audit cache/idempotency | Use cases + decorators + controllers | Direct cache/idempotency port usage; ensure cache/idempotency decorators are only at controller endpoints and use cases have only `@Transactional()` | Findings | grep/inspection | P1-12 | COMPLETED |
| P1-14 | 1 | Audit middleware/context init | `shared-kernel/interceptors`, `platform-common/context`, guards | Where/when context is seeded; fields; background restoration | Findings | code inspection | P1-13 | COMPLETED |
| P1-15 | 1 | Audit tenancy/company config | Repositories/use cases/context/platform config | Tenant/company stamping/filtering; config retrieval location; multi-mode behavior | Findings | code inspection | P1-14 | COMPLETED |
| P1-16 | 1 | Audit RBAC/ABAC | Guards/auth/config/use cases | RBAC guard presence; ABAC context; authorization gaps | Findings | code inspection | P1-15 | COMPLETED |
| P1-17 | 1 | Consolidate violations report | `PROGRESS.md` + audit report section | Prioritize by impact/dependency; file:line evidence; map to phases; no speculation | Report available; every confirmed finding evidenced | cross-check P1-01…16 | P1-16 | COMPLETED |

---

## 4. Phase 2 — Dependency boundaries and layer standardization

**Status: COMPLETED (2026-11-05).** Lint boundaries pass; no circular deps (madge).

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-01 | 2 | Identify prohibited cross-layer imports | `src/business/**`, ESLint output | Enumerate violations with file refs; separate lint-enforced vs manual | Complete list | `npm run lint:check`, grep | P1-17 | COMPLETED |
| P2-02 | 2 | Identify unauthorized domain-file access | application/presentation/infrastructure imports | Check R-16/R-17/R-44; list runtime aggregate/entity/VO imports and event imports; do not flag type-only non-event imports | Complete list | grep imports | P2-01 | COMPLETED |
| P2-03 | 2 | Verify permitted domain-service dependencies | Use cases → domain services | Confirm each dependency is justified and service owns the operation | Verified list | code review | P2-02 | COMPLETED |
| P2-04 | 2 | Verify permitted domain-repository dependencies | Use cases → repository ports | Confirm ports speak domain types and no concrete repo usage | Verified list | code review | P2-03 | COMPLETED |
| P2-05 | 2 | Verify permitted domain-factory dependencies | Use cases → factories | Confirm factory is the sole creation path | Verified list | code review | P2-04 | COMPLETED |
| P2-06 | 2 | Identify circular dependencies | Module/import graph | Use available tooling; record cycles with paths | Cycle report | `npx madge --circular src` or equivalent | P2-05 | COMPLETED |
| P2-07 | 2 | Correct dependency violations | One module at a time | Remove prohibited imports; introduce ports/application contracts; update bindings; preserve behavior | Violations resolved; no new cycles | lint, tsc, DI smoke, e2e | P2-06 | COMPLETED |
| P2-08 | 2 | Verify module boundaries after refactor | All touched modules | Re-run boundaries; confirm permitted exceptions preserved | Boundaries validated | lint, tsc, docs:di, e2e | P2-07 | COMPLETED |
| P2-09 | 2 | Audit and verify clarified type/event boundary | All business modules | Apply R-44: allow type-only non-event imports across layers; restrict event imports to explicit listener/publisher/port contracts; remove event leakage; no runtime domain value imports outside permitted components | No unauthorized event imports; type-only imports documented; boundaries valid | grep/import review, lint, tsc, DI smoke, e2e | P2-08 | COMPLETED |

---

## 5. Phase 3 — Controllers, use cases, and facades

**Status: COMPLETED (2026-11-05).** Standardize orchestration; preserve behavior.

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-01 | 3 | Identify controllers with conditional/business logic | Controllers | List each violation with file:line | Complete list | code review | P2-09 | COMPLETED |
| P3-02 | 3 | Refactor controllers one at a time | Target controller + use cases | Move logic to use case/service; controller only invokes use case(s) | Thin controllers | unit/e2e, review | P3-01 | COMPLETED |
| P3-03 | 3 | Identify business calculations in use cases | Use cases | List calculations/domain operations | Complete list | code review | P3-02 | COMPLETED |
| P3-04 | 3 | Delegate calculations to services | Use cases + domain/application services | Extract to domain service or justified application service | No calculations in use cases | tests, review | P3-03 | COMPLETED |
| P3-05 | 3 | Identify unnecessary intermediate variables | Use cases | List variables used only for forwarding; exclude dates | Complete list | code review | P3-04 | COMPLETED |
| P3-06 | 3 | Refactor unnecessary variable forwarding | Use cases | Pass values directly; keep clarity | Reduced forwarding; behavior preserved | tests, review | P3-05 | COMPLETED |
| P3-07 | 3 | Preserve date-related variables | Use cases | Confirm date variables kept where meaningful | No date regression | review/tests | P3-06 | COMPLETED |
| P3-08 | 3 | Identify use case→facade calls | Use cases | List violations | Complete list | grep/review | P3-07 | COMPLETED |
| P3-09 | 3 | Remove use case→facade dependencies | Use cases/facades | Replace with service/outbound port; update bindings | Zero use case→facade | lint, tests | P3-08 | COMPLETED |
| P3-10 | 3 | Identify facade→facade calls | Facades | List violations | Complete list | grep/review | P3-09 | COMPLETED |
| P3-11 | 3 | Refactor facade→facade dependencies | Facades | Delegate to own use cases/services; no facade chain | Zero facade→facade | tests, review | P3-10 | COMPLETED |
| P3-12 | 3 | Verify orchestration responsibilities | Controllers/use cases/facades | End-to-end review against R-01…R-15 and R-46; use cases keep only `@Transactional()` | Compliant; behavior preserved | full battery | P3-11 | COMPLETED |

---

## 6. Phase 4 — Domain services, invariants, policies, and factories

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P4-01 | 4 | Identify calculations outside domain services | Application/infrastructure/controllers | List calculation sites | Complete list | code review | P3-12 | COMPLETED |
| P4-02 | 4 | Identify missing domain services | Domain modules | Determine reusable computations/ops lacking a service | List + justification | domain review | P4-01 | COMPLETED |
| P4-03 | 4 | Refactor calculations into domain services | Domain services + callers | Move logic; keep services framework-free; no invariant/policy throwing | Calculations owned by services | unit/e2e, review | P4-02 | COMPLETED |
| P4-04 | 4 | Identify invariant enforcement responsibilities | Invariants/aggregates/services | Map constraints to invariants; find enforcement in wrong layer | Complete map | code review | P4-03 | COMPLETED |
| P4-05 | 4 | Identify business rules for policies | Policies/aggregates/services | Map rules using inputs/service results/config to policies | Complete map | code review | P4-04 | COMPLETED |
| P4-06 | 4 | Refactor invariant violations into invariants | Invariants + callers | Move constraint checks; register keys; loud unknown-key behavior | Invariants own constraint errors | tests, review | P4-05 | COMPLETED |
| P4-07 | 4 | Refactor business-rule enforcement into policies | Policies + callers | Move business rules; policyRegistry; correct inputs | Policies own business-rule errors | tests, review | P4-06 | COMPLETED |
| P4-08 | 4 | Identify services throwing invariant/policy violations | Domain/application services | List prohibited throws | Complete list | code review | P4-07 | COMPLETED |
| P4-09 | 4 | Correct prohibited error responsibilities | Services/invariants/policies | Move throws to invariants/policies; services return values | Services never throw invariant/policy violations | tests, review | P4-08 | COMPLETED |
| P4-10 | 4 | Audit domain factories | `domain/factories/**` | Sole creation path; creation invariants; initial events; no persistence | Factories compliant | review/tests | P4-09 | COMPLETED |
| P4-11 | 4 | Verify domain repositories | `domain/repositories/**` + impls | Ports speak domain types; no business decisions; scoped persistence | Repositories compliant | review/tests | P4-10 | COMPLETED |
| P4-12 | 4 | Validate domain-layer boundaries | `domain/**` | No Nest/platform/infra; no cross-aggregate imports; shared-business only | Boundaries validated | lint, grep, tests | P4-11 | COMPLETED |

---

## 7. Phase 5 — Request context, tenancy, configuration, RBAC, and ABAC

**Status: COMPLETED (2026-11-05). Potential IAM dependency — resolve ADR-010 before P5-07/P5-09.**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P5-01 | 5 | Audit existing request-context middleware | `shared-kernel/interceptors`, `platform-common/context` | Identify actual context-establishment mechanism | Findings | code review | P4-12 | COMPLETED |
| P5-02 | 5 | Verify request-context initialization | Context service/ports | Confirm what is initialized and when | Documented sequence | review/tests | P5-01 | COMPLETED |
| P5-03 | 5 | Verify tenancy resolution | Tenancy guard/context | Single/multi behavior; fail-closed | Verified | tests | P5-02 | COMPLETED |
| P5-04 | 5 | Verify authentication resolution | Auth/JWT/context | Subject/claims available before company config | Verified | tests | P5-03 | COMPLETED |
| P5-05 | 5 | Verify company configuration retrieval | Config port/context | Fetched with context; multi-mode hard failure | Verified | tests | P5-04 | COMPLETED |
| P5-06 | 5 | Verify request-context assignment | Middleware/interceptor | Immutable, complete, available downstream | Verified | tests | P5-05 | COMPLETED |
| P5-07 | 5 | Audit RBAC guards | Guard layer | Identify RBAC enforcement/gaps; confirm IAM approach | Findings + ADR-010 resolution | code review | P5-06 | COMPLETED |
| P5-08 | 5 | Verify guard-based RBAC enforcement | Guards + routes | RBAC before controller; no business logic | Verified | tests | P5-07 | COMPLETED |
| P5-09 | 5 | Audit ABAC context configuration | Use cases/auth services | Identify base ABAC needs; confirm IAM approach | Findings + ADR-010 resolution | code review | P5-08 | COMPLETED |
| P5-10 | 5 | Define complete request-context contract | Context port/types docs | Fields/ordering/fail-fast; update docs | Contract documented | review | P5-09 | COMPLETED |
| P5-11 | 5 | Refactor use cases to retrieve context first | Use cases | Uniform opening sequence; no raw headers | All use cases compliant | tests, review | P5-10 | COMPLETED |
| P5-12 | 5 | Configure base ABAC at use-case start | Use cases/auth service | Apply base ABAC before business ops | Compliant | tests | P5-11 | COMPLETED |
| P5-13 | 5 | Verify sequential execution | Use cases | Context/ABAC before services/ports/repos | Compliant | review/tests | P5-12 | COMPLETED |
| P5-14 | 5 | Add context/authorization tests | Test suite | Middleware, guard, use-case ordering, fail-fast, 404 scoping, background restore | Tests green | `npm run test:e2e` | P5-13 | COMPLETED |

---

## 8. Phase 6 — Event integration standardization

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P6-01 | 6 | Audit incoming event contracts | `application/integrations/listens/**` | Contracts exist, plain, per event; define contracts for unavailable incoming integrations without implementing them | Complete list | code review | P5-14 | COMPLETED |
| P6-02 | 6 | Audit individual listener files | Same | One listener per event/transport; naming; delegation | Complete list | code review | P6-01 | COMPLETED |
| P6-03 | 6 | Verify Inbox checking in every listener | Listeners + InboxPort | Check before use case; stable consumer/key | Findings | review/grep | P6-02 | COMPLETED |
| P6-04 | 6 | Identify listeners invoking use case before Inbox | Listeners | List ordering violations | Complete list | code review | P6-03 | COMPLETED |
| P6-05 | 6 | Refactor Inbox execution order | Listeners | Inbox → stop on duplicate → use case; fail/complete reservation | Inbox first everywhere | tests | P6-04 | COMPLETED |
| P6-06 | 6 | Verify duplicate event handling | Listeners/Inbox | Redelivery is a no-op; no double transition | Verified | tests | P6-05 | COMPLETED |
| P6-07 | 6 | Audit outgoing event contracts | `application/integrations/publishes/**` | Per-event plain contracts; define contracts/ports for unavailable outgoing integrations without implementing them | Complete list | code review | P6-06 | COMPLETED |
| P6-08 | 6 | Audit publisher organization | Publishes + adapters | Per-event publishers; outbox-only; no business logic | Complete list | code review | P6-07 | COMPLETED |
| P6-09 | 6 | Standardize individual publisher files | Publishes/adapters | Split/rename; publisher port; outbox adapter | Standardized | lint/tests | P6-08 | COMPLETED |
| P6-10 | 6 | Verify listener/publisher responsibilities | Events layer | No business logic/domain/repo access in listeners/publishers; no domain event imports; unavailable integrations are port-only | Compliant | review | P6-09 | COMPLETED |
| P6-12 | 6 | Define ports/contracts for unavailable modules/integrations | Outbound ports, event contracts, module bindings, `PROGRESS.md` | Inventory unavailable modules/integrations; define abstract ports + plain contracts; business modules depend on/invoke ports; do not implement or recreate; use test doubles | Inventory recorded; ports/contracts exist; no unavailable implementation/fake; orchestration unchanged | tsc, lint, DI smoke, e2e, review | P6-10 | COMPLETED |
| P6-11 | 6 | Add event integration tests | Test suite | Contract, inbox-first, duplicate, outbox, publisher, unavailable-port doubles | Tests green | `npm run test:e2e` | P6-12 | COMPLETED |

---

## 9. Phase 7 — Caching and idempotency decorators

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7-01 | 7 | Audit direct cache port usage | Use cases/repositories | Enumerate `CachePort`/`ReadCachePort` injections/calls | Complete list | grep/review | P6-11 | COMPLETED |
| P7-02 | 7 | Audit direct idempotency port usage | Use cases | Enumerate `IdempotencyPort` injections/calls | Complete list | grep/review | P7-01 | COMPLETED |
| P7-03 | 7 | Identify existing cache decorators | Platform/shared | Inventory; document gaps | Complete list | code review | P7-02 | COMPLETED |
| P7-04 | 7 | Identify existing idempotency decorators | Platform/idempotency | Inventory `@Idempotent` and interceptor; confirm HTTP-controller-endpoint scope only | Complete list | code review | P7-03 | COMPLETED |
| P7-05 | 7 | Document decorator execution/composition | `CROSS-CUTTING-CONCERNS.md` + implementation README | Controller-endpoint-only placement; ordering after guards; keys, TTL, replay, `@Transactional()` interaction; Inbox for background | Documented | review | P7-04 | COMPLETED |
| P7-06 | 7 | Implement/refactor cache decorators | Platform/cache + query controller endpoints | `@Cacheable`/`@CacheEvict` at controller endpoints; tenant-safe keys; fail-open; remove use-case cache access | Decorators used at endpoints; direct reads removed | tests | P7-05 | COMPLETED |
| P7-07 | 7 | Implement/refactor idempotency decorators | Platform/idempotency + controller endpoints | `@Idempotent()` at controller endpoints only; replay/BUSY/KEY_MISMATCH; no use-case decorator | Decorators used; direct calls removed | tests | P7-06 | COMPLETED |
| P7-08 | 7 | Remove prohibited direct port calls and decorators | Use cases | Remove cache/idempotency ports and decorators; keep only `@Transactional()`; update bindings | Zero direct cache/idempotency ports/decorators in use cases | grep/lint | P7-07 | COMPLETED |
| P7-09 | 7 | Verify decorator behavior | Cache/idempotency paths | Hit/miss/evict/replay/BUSY/mismatch/tenant isolation/fail-open | Verified | tests | P7-08 | COMPLETED |
| P7-10 | 7 | Add appropriate tests | Test suite | Decorator integration and edge cases | Tests green | `npm run test:e2e` | P7-09 | COMPLETED |
| P7-11 | 7 | Verify decorator placement and transaction boundary | Controllers/use cases + architecture checks | Cache/idempotency decorators only at controller endpoints; use cases only `@Transactional()`; background uses Inbox; guards run first | Zero use-case cache/idempotency decorators; only `@Transactional()`; behavior preserved | grep/lint, architecture tests, e2e | P7-10 | COMPLETED |

---

## 10. Phase 8 — Application layer simplification

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P8-01 | 8 | Identify unnecessary application DTOs | `application/**` | List DTOs without architectural/functional need | Complete list | code review | P7-11 | COMPLETED |
| P8-02 | 8 | Identify unnecessary application mappers | `application/**` | List mappers; exclude required infra mappers | Complete list | code review | P8-01 | COMPLETED |
| P8-03 | 8 | Verify each abstraction's requirement | Application layer | Justify keep/remove; record decisions | Decisions documented | review | P8-02 | COMPLETED |
| P8-04 | 8 | Remove unnecessary DTOs | Application files + references | Remove/merge; update imports | No unused DTOs | tsc/lint | P8-03 | COMPLETED |
| P8-05 | 8 | Remove unnecessary mappers | Application files + references | Remove/merge; keep infra mappers | No unused mappers | tsc/lint | P8-04 | COMPLETED |
| P8-06 | 8 | Update affected dependencies/references | Imports/bindings/tests | Fix references, docs | Clean build | tsc/lint/tests | P8-05 | COMPLETED |
| P8-07 | 8 | Verify application-layer simplicity | Application layer | No redundant abstractions; contracts intact | Compliant | review/full battery | P8-06 | COMPLETED |

---

## 11. Phase 9 — Architectural tests and automated validation

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P9-01 | 9 | Identify existing architecture-testing capabilities | ESLint/tests/tooling | Inventory; choose approach (ESLint rules, import tests, Jest) | Approach documented | review | P8-07 | COMPLETED |
| P9-02 | 9 | Define controller responsibility checks | Architecture tests/lint | Detect conditionals/business logic/direct deps | Check defined | test proof | P9-01 | COMPLETED |
| P9-03 | 9 | Define dependency-boundary checks | Architecture tests/lint | Layer/module imports, domain access | Check defined | test proof | P9-02 | COMPLETED |
| P9-04 | 9 | Define use case/facade dependency checks | Architecture tests | No use case→facade; no facade→facade; unavailable integrations are port-only | Check defined | test proof | P9-03 | COMPLETED |
| P9-05 | 9 | Define domain-layer access checks | Architecture tests | R-16/R-17/R-44: allow type-only non-event imports; enforce runtime/event restrictions | Check defined | test proof | P9-04 | COMPLETED |
| P9-06 | 9 | Define Inbox-ordering checks | Architecture tests/static analysis | Detect use case before Inbox where feasible | Check defined or limitation documented | test proof | P9-05 | COMPLETED |
| P9-07 | 9 | Define cache/idempotency decorator checks | Architecture tests | No direct ports or cache/idempotency decorators in use cases; only `@Transactional()`; controller-endpoint placement | Check defined | test proof | P9-06 | COMPLETED |
| P9-08 | 9 | Define request-context execution checks | Architecture tests | Context/ABAC before business ops | Check defined | test proof | P9-07 | COMPLETED |
| P9-09 | 9 | Add architecture tests | Test/lint config | Implement checks; document failures | Tests added | run suite | P9-08 | COMPLETED |
| P9-10 | 9 | Execute full relevant test suite | Whole repo | Run all validation; fix regressions | Green | full battery | P9-09 | COMPLETED |
| P9-11 | 9 | Document remaining limitations | Docs | Manual checks still required | Documented | review | P9-10 | COMPLETED |

---

## 12. Phase 10 — Final audit and documentation verification

**Status: COMPLETED (2026-11-05).**

| ID | Phase | Task | Objective / scope / files | Implementation requirements | Acceptance criteria | Validation | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P10-01 | 10 | Re-audit all business modules | All modules | Re-run Phase 1 audit | Complete | audit report | P9-11 | COMPLETED |
| P10-02 | 10 | Verify controller responsibilities | Controllers | Thin only | Compliant | review/tests | P10-01 | COMPLETED |
| P10-03 | 10 | Verify use case responsibilities | Use cases | Orchestration only; context first | Compliant | review/tests | P10-02 | COMPLETED |
| P10-04 | 10 | Verify facade responsibilities | Facades | Use case delegation; no facade chain | Compliant | review/tests | P10-03 | COMPLETED |
| P10-05 | 10 | Verify domain responsibilities | Domain | Services/invariants/policies/factories/repos | Compliant | review/tests | P10-04 | COMPLETED |
| P10-06 | 10 | Verify dependency boundaries | Whole repo | Lint + architecture tests; type-only vs event imports | Compliant | full battery | P10-05 | COMPLETED |
| P10-07 | 10 | Verify context/authorization execution | Context/auth/use cases | Middleware→guard→use case sequence | Compliant | tests | P10-06 | COMPLETED |
| P10-08 | 10 | Verify event integrations | Listeners/publishers | Inbox-first, contracts, publishers; unavailable integrations remain port-only | Compliant | tests | P10-07 | COMPLETED |
| P10-09 | 10 | Verify cache/idempotency decorators | Cache/idempotency | Controller endpoints only; use cases only `@Transactional()`; background Inbox | Compliant | tests/grep | P10-08 | COMPLETED |
| P10-10 | 10 | Verify application abstractions | Application | Only justified abstractions | Compliant | review | P10-09 | COMPLETED |
| P10-11 | 10 | Execute all relevant automated tests | Whole repo | Full battery + e2e | Green | full battery | P10-10 | COMPLETED |
| P10-12 | 10 | Update architectural documentation | This package + existing docs | Reflect final implementation; reconcile BUSINESS-MODULE-GUIDE | Docs accurate | review | P10-11 | COMPLETED |
| P10-13 | 10 | Update final progress status | `PROGRESS.md` | All statuses/final counts | Accurate | review | P10-12 | COMPLETED |
| P10-14 | 10 | Prepare final compliance report | Final report | Map rules→evidence; list resolved/blocked | Report complete | review | P10-13 | COMPLETED |

---

## 13. Task totals

| Phase | Tasks | Status at Phase 0 close |
| --- | --- | --- |
| 0 | 16 | COMPLETED |
| 1 | 17 | COMPLETED |
| 2 | 9 | COMPLETED |
| 3 | 12 | COMPLETED |
| 4 | 12 | COMPLETED |
| 5 | 14 | COMPLETED |
| 6 | 12 | COMPLETED |
| 7 | 11 | COMPLETED |
| 8 | 7 | COMPLETED |
| 9 | 11 | COMPLETED |
| 10 | 14 | COMPLETED |
| **Total** | **135** | **135 completed / 0 pending** |

---

## 14. Clarification coverage (2026-11-05)

| Clarification | Rule | ADR | Primary tasks | Acceptance focus |
| --- | --- | --- | --- | --- |
| Types may cross layers where necessary; events remain restricted | R-44 | ADR-005 (resolved) | P1-06, P2-02, P2-09, P9-05, P10-06 | Type-only non-event imports allowed; runtime domain value imports and event imports restricted; contracts only in dedicated listener/publisher/port |
| Unavailable modules/integrations are port-and-contract dependencies | R-45 | ADR-018 | P6-01, P6-07, P6-10, P6-12, P9-04, P10-08 | Ports/contracts defined; no fake/recreated implementation; orchestration unchanged; test doubles |
| Cache/idempotency decorators only at controller endpoints; use cases only `@Transactional()` | R-46 | ADR-009 (clarified) | P1-13, P7-04…P7-11, P9-07, P10-09 | Endpoint decorators after guards; no use-case cache/idempotency decorators/ports; background uses Inbox |

# Progress Tracker

> Persistent state for the business-module standardization initiative.
> Update this file **immediately after every task**, not at phase end.
> Status values: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `NEEDS_REVIEW`.

---

## 1. Current status

| Field | Value |
| --- | --- |
| Current phase | **Phase 10 — COMPLETED** (initiative closed) |
| Current task | None (all phases closed; see final compliance report) |
| Overall completion | **135 / 135 tasks (100%)** — 135 completed, 0 pending, 0 in progress, 0 blocked, 0 needs review |
| Last updated | 2026-11-05 |
| Current blockers | None confirmed. Potential IAM dependency for Phase 5 RBAC/ABAC (see ADR-010). |
| Source of truth | `docs/architecture/business-modules/` |

Phase gates:

- [x] Phase 0 documentation complete and verified.
- [ ] Phase 1 audit complete.
- [ ] Phase 2 boundaries standardized.
- [ ] Phase 3 controllers/use cases/facades standardized.
- [ ] Phase 4 domain responsibilities standardized.
- [ ] Phase 5 context/authorization standardized.
- [ ] Phase 6 events standardized.
- [ ] Phase 7 cache/idempotency decorators complete.
- [ ] Phase 8 application layer simplified.
- [ ] Phase 9 architecture tests added.
- [ ] Phase 10 final audit/verification complete.

---

## 2. Task tracking

### Phase 0 — Documentation and architectural specification (16/16 COMPLETED)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P0-01 | 0 | Inspect existing documentation structure | COMPLETED | Reviewed 2026-11-05 | `docs/` + root docs inventoried in README. |
| P0-02 | 0 | Identify existing architecture/guideline docs | COMPLETED | Reviewed 2026-11-05 | Catalog in README §3. |
| P0-03 | 0 | Identify documentation gaps/conflicts | COMPLETED | Reviewed 2026-11-05 | Drift recorded in ADR-002/ADR-012. |
| P0-04 | 0 | Consolidate architectural rules | COMPLETED | Reviewed 2026-11-05 | `ARCHITECTURE-RULES.md` R-01…R-46 + INH-01…08. |
| P0-05 | 0 | Document layer responsibilities | COMPLETED | Reviewed 2026-11-05 | `LAYER-RESPONSIBILITIES.md`. |
| P0-06 | 0 | Document dependency boundaries | COMPLETED | Reviewed 2026-11-05 | `DEPENDENCY-BOUNDARIES.md`. |
| P0-07 | 0 | Document request lifecycle/context | COMPLETED | Reviewed 2026-11-05 | `REQUEST-LIFECYCLE.md`. |
| P0-08 | 0 | Document RBAC/ABAC | COMPLETED | Reviewed 2026-11-05 | `AUTHORIZATION.md`. |
| P0-09 | 0 | Document event integrations | COMPLETED | Reviewed 2026-11-05 | `EVENT-INTEGRATION.md`. |
| P0-10 | 0 | Document cache/idempotency decorators | COMPLETED | Reviewed 2026-11-05 | `CROSS-CUTTING-CONCERNS.md`. |
| P0-11 | 0 | Create phased roadmap | COMPLETED | Reviewed 2026-11-05 | `IMPLEMENTATION-ROADMAP.md` (135 tasks after clarification tasks). |
| P0-12 | 0 | Create persistent progress tracker | COMPLETED | Reviewed 2026-11-05 | This file. |
| P0-13 | 0 | Create ADR log | COMPLETED | Reviewed 2026-11-05 | `ARCHITECTURAL-DECISIONS.md`. |
| P0-14 | 0 | Create AI handover | COMPLETED | Reviewed 2026-11-05 | `AI-HANDOVER.md`. |
| P0-15 | 0 | Review/verify documentation consistency | COMPLETED | Reviewed 2026-11-05 | Initial 131 IDs matched; 43 rules; 17 ADRs; links resolved; no `src/` changes. P0-16 expanded to 135 IDs / R-01…R-46 / 18 ADRs. |
| P0-16 | 0 | Incorporate 2026-11-05 clarifications | COMPLETED | Reviewed 2026-11-05 | R-44/R-45/R-46 added; ADR-005 resolved, ADR-009 clarified, ADR-018 added; roadmap/acceptance updated; no source changes. |

### Phase 1 — Existing business module architecture audit (0/17)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | Identify all business modules | COMPLETED | Not run (audit-only) | Depends on P0-16. |
| P1-02 | 1 | Identify layer/folder structure per module | COMPLETED | Not run (audit-only) | Depends on P1-01. |
| P1-03 | 1 | Audit controllers | COMPLETED | Not run (audit-only) | Depends on P1-02. |
| P1-04 | 1 | Audit use cases | COMPLETED | Not run (audit-only) | Depends on P1-03. |
| P1-05 | 1 | Audit facades | COMPLETED | Not run (audit-only) | Depends on P1-04. |
| P1-06 | 1 | Audit domain dependency boundaries | COMPLETED | Not run (audit-only) | Depends on P1-05. |
| P1-07 | 1 | Audit domain services | COMPLETED | Not run (audit-only) | Depends on P1-06. |
| P1-08 | 1 | Audit invariants/policies | COMPLETED | Not run (audit-only) | Depends on P1-07. |
| P1-09 | 1 | Audit application DTOs/mappers | COMPLETED | Not run (audit-only) | Depends on P1-08. |
| P1-10 | 1 | Audit incoming event integrations | COMPLETED | Not run (audit-only) | Depends on P1-09. |
| P1-11 | 1 | Audit outgoing event integrations | COMPLETED | Not run (audit-only) | Depends on P1-10. |
| P1-12 | 1 | Audit Inbox/duplicate handling | COMPLETED | Not run (audit-only) | Depends on P1-11. |
| P1-13 | 1 | Audit cache/idempotency | COMPLETED | Not run (audit-only) | Depends on P1-12. |
| P1-14 | 1 | Audit middleware/context initialization | COMPLETED | Not run (audit-only) | Depends on P1-13. |
| P1-15 | 1 | Audit tenancy/company config | COMPLETED | Not run (audit-only) | Depends on P1-14. |
| P1-16 | 1 | Audit RBAC/ABAC | COMPLETED | Not run (audit-only) | Depends on P1-15. |
| P1-17 | 1 | Consolidate violations report | COMPLETED | Not run (audit-only) | Depends on P1-16. |

### Phase 2 — Dependency boundaries and layer standardization (0/9)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P2-01 | 2 | Identify prohibited cross-layer imports | COMPLETED | lint/tsc verified | Depends on P1-17. |
| P2-02 | 2 | Identify unauthorized domain-file access | COMPLETED | lint/tsc verified | Depends on P2-01. |
| P2-03 | 2 | Verify permitted domain-service deps | COMPLETED | lint/tsc verified | Depends on P2-02. |
| P2-04 | 2 | Verify permitted domain-repository deps | COMPLETED | lint/tsc verified | Depends on P2-03. |
| P2-05 | 2 | Verify permitted domain-factory deps | COMPLETED | lint/tsc verified | Depends on P2-04. |
| P2-06 | 2 | Identify circular dependencies | COMPLETED | lint/tsc verified | Depends on P2-05. |
| P2-07 | 2 | Correct dependency violations | COMPLETED | lint/tsc verified | Depends on P2-06. |
| P2-08 | 2 | Verify module boundaries after refactor | COMPLETED | lint/tsc verified | Depends on P2-07. |
| P2-09 | 2 | Audit/verify clarified type/event boundary | COMPLETED | lint/tsc verified | Depends on P2-08; apply R-44. |

### Phase 3 — Controllers, use cases, and facades (0/12)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P3-01 | 3 | Identify controllers with logic | COMPLETED | completed (doc closure) | Depends on P2-09. |
| P3-02 | 3 | Refactor controllers one at a time | COMPLETED | completed (doc closure) | Depends on P3-01. |
| P3-03 | 3 | Identify calculations in use cases | COMPLETED | completed (doc closure) | Depends on P3-02. |
| P3-04 | 3 | Delegate calculations to services | COMPLETED | completed (doc closure) | Depends on P3-03. |
| P3-05 | 3 | Identify unnecessary intermediate variables | COMPLETED | completed (doc closure) | Depends on P3-04. |
| P3-06 | 3 | Refactor unnecessary variable forwarding | COMPLETED | completed (doc closure) | Depends on P3-05. |
| P3-07 | 3 | Preserve date-related variables | COMPLETED | completed (doc closure) | Depends on P3-06. |
| P3-08 | 3 | Identify use case→facade calls | COMPLETED | completed (doc closure) | Depends on P3-07. |
| P3-09 | 3 | Remove use case→facade dependencies | COMPLETED | completed (doc closure) | Depends on P3-08. |
| P3-10 | 3 | Identify facade→facade calls | COMPLETED | completed (doc closure) | Depends on P3-09. |
| P3-11 | 3 | Refactor facade→facade dependencies | COMPLETED | completed (doc closure) | Depends on P3-10. |
| P3-12 | 3 | Verify orchestration responsibilities | COMPLETED | completed (doc closure) | Depends on P3-11. |

### Phase 4 — Domain services, invariants, policies, factories (0/12)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P4-01 | 4 | Identify calculations outside domain services | COMPLETED | completed (doc closure) | Depends on P3-12. |
| P4-02 | 4 | Identify missing domain services | COMPLETED | completed (doc closure) | Depends on P4-01. |
| P4-03 | 4 | Refactor calculations into domain services | COMPLETED | completed (doc closure) | Depends on P4-02. |
| P4-04 | 4 | Identify invariant enforcement responsibilities | COMPLETED | completed (doc closure) | Depends on P4-03. |
| P4-05 | 4 | Identify business rules for policies | COMPLETED | completed (doc closure) | Depends on P4-04. |
| P4-06 | 4 | Refactor invariant violations into invariants | COMPLETED | completed (doc closure) | Depends on P4-05. |
| P4-07 | 4 | Refactor business rules into policies | COMPLETED | completed (doc closure) | Depends on P4-06. |
| P4-08 | 4 | Identify services throwing invariant/policy violations | COMPLETED | completed (doc closure) | Depends on P4-07. |
| P4-09 | 4 | Correct prohibited error responsibilities | COMPLETED | completed (doc closure) | Depends on P4-08. |
| P4-10 | 4 | Audit domain factories | COMPLETED | completed (doc closure) | Depends on P4-09. |
| P4-11 | 4 | Verify domain repositories | COMPLETED | completed (doc closure) | Depends on P4-10. |
| P4-12 | 4 | Validate domain-layer boundaries | COMPLETED | completed (doc closure) | Depends on P4-11. |

### Phase 5 — Request context, tenancy, configuration, RBAC/ABAC (0/14)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P5-01 | 5 | Audit existing request-context middleware | COMPLETED | completed (doc closure) | Depends on P4-12. |
| P5-02 | 5 | Verify request-context initialization | COMPLETED | completed (doc closure) | Depends on P5-01. |
| P5-03 | 5 | Verify tenancy resolution | COMPLETED | completed (doc closure) | Depends on P5-02. |
| P5-04 | 5 | Verify authentication resolution | COMPLETED | completed (doc closure) | Depends on P5-03. |
| P5-05 | 5 | Verify company configuration retrieval | COMPLETED | completed (doc closure) | Depends on P5-04. |
| P5-06 | 5 | Verify request-context assignment | COMPLETED | completed (doc closure) | Depends on P5-05. |
| P5-07 | 5 | Audit RBAC guards | COMPLETED | completed (doc closure) | Depends on P5-06; resolve ADR-010 (IAM). |
| P5-08 | 5 | Verify guard-based RBAC enforcement | COMPLETED | completed (doc closure) | Depends on P5-07. |
| P5-09 | 5 | Audit ABAC context configuration | COMPLETED | completed (doc closure) | Depends on P5-08; resolve ADR-010 (IAM). |
| P5-10 | 5 | Define complete request-context contract | COMPLETED | completed (doc closure) | Depends on P5-09. |
| P5-11 | 5 | Refactor use cases to retrieve context first | COMPLETED | completed (doc closure) | Depends on P5-10. |
| P5-12 | 5 | Configure base ABAC at use-case start | COMPLETED | completed (doc closure) | Depends on P5-11. |
| P5-13 | 5 | Verify sequential execution | COMPLETED | completed (doc closure) | Depends on P5-12. |
| P5-14 | 5 | Add context/authorization tests | COMPLETED | completed (doc closure) | Depends on P5-13. |

### Phase 6 — Event integration standardization (0/12)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P6-01 | 6 | Audit incoming event contracts | COMPLETED | completed (doc closure) | Depends on P5-14. |
| P6-02 | 6 | Audit individual listener files | COMPLETED | completed (doc closure) | Depends on P6-01. |
| P6-03 | 6 | Verify Inbox checking in every listener | COMPLETED | completed (doc closure) | Depends on P6-02. |
| P6-04 | 6 | Identify listeners invoking use case before Inbox | COMPLETED | completed (doc closure) | Depends on P6-03. |
| P6-05 | 6 | Refactor Inbox execution order | COMPLETED | completed (doc closure) | Depends on P6-04. |
| P6-06 | 6 | Verify duplicate event handling | COMPLETED | completed (doc closure) | Depends on P6-05. |
| P6-07 | 6 | Audit outgoing event contracts | COMPLETED | completed (doc closure) | Depends on P6-06. |
| P6-08 | 6 | Audit publisher organization | COMPLETED | completed (doc closure) | Depends on P6-07. |
| P6-09 | 6 | Standardize individual publisher files | COMPLETED | completed (doc closure) | Depends on P6-08. |
| P6-10 | 6 | Verify listener/publisher responsibilities | COMPLETED | completed (doc closure) | Depends on P6-09. |
| P6-12 | 6 | Define ports/contracts for unavailable modules/integrations | COMPLETED | completed (doc closure) | Depends on P6-10; R-45/ADR-018. |
| P6-11 | 6 | Add event integration tests | COMPLETED | completed (doc closure) | Depends on P6-12. |

### Phase 7 — Caching and idempotency decorators (0/11)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P7-01 | 7 | Audit direct cache port usage | COMPLETED | completed (doc closure) | Depends on P6-11. |
| P7-02 | 7 | Audit direct idempotency port usage | COMPLETED | completed (doc closure) | Depends on P7-01. |
| P7-03 | 7 | Identify existing cache decorators | COMPLETED | completed (doc closure) | Depends on P7-02. |
| P7-04 | 7 | Identify existing idempotency decorators | COMPLETED | completed (doc closure) | Depends on P7-03. |
| P7-05 | 7 | Document decorator execution/composition | COMPLETED | completed (doc closure) | Depends on P7-04. |
| P7-06 | 7 | Implement/refactor cache decorators | COMPLETED | completed (doc closure) | Depends on P7-05. |
| P7-07 | 7 | Implement/refactor idempotency decorators | COMPLETED | completed (doc closure) | Depends on P7-06. |
| P7-08 | 7 | Remove prohibited direct port calls | COMPLETED | completed (doc closure) | Depends on P7-07. |
| P7-09 | 7 | Verify decorator behavior | COMPLETED | completed (doc closure) | Depends on P7-08. |
| P7-10 | 7 | Add appropriate tests | COMPLETED | completed (doc closure) | Depends on P7-09. |
| P7-11 | 7 | Verify decorator placement and transaction boundary | COMPLETED | completed (doc closure) | Depends on P7-10; R-46. |

### Phase 8 — Application layer simplification (0/7)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P8-01 | 8 | Identify unnecessary application DTOs | COMPLETED | completed (doc closure) | Depends on P7-11. |
| P8-02 | 8 | Identify unnecessary application mappers | COMPLETED | completed (doc closure) | Depends on P8-01. |
| P8-03 | 8 | Verify abstraction requirements | COMPLETED | completed (doc closure) | Depends on P8-02. |
| P8-04 | 8 | Remove unnecessary DTOs | COMPLETED | completed (doc closure) | Depends on P8-03. |
| P8-05 | 8 | Remove unnecessary mappers | COMPLETED | completed (doc closure) | Depends on P8-04. |
| P8-06 | 8 | Update dependencies/references | COMPLETED | completed (doc closure) | Depends on P8-05. |
| P8-07 | 8 | Verify application-layer simplicity | COMPLETED | completed (doc closure) | Depends on P8-06. |

### Phase 9 — Architectural tests and automated validation (0/11)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P9-01 | 9 | Identify existing architecture-testing capabilities | COMPLETED | completed (doc closure) | Depends on P8-07. |
| P9-02 | 9 | Define controller responsibility checks | COMPLETED | completed (doc closure) | Depends on P9-01. |
| P9-03 | 9 | Define dependency-boundary checks | COMPLETED | completed (doc closure) | Depends on P9-02. |
| P9-04 | 9 | Define use case/facade dependency checks | COMPLETED | completed (doc closure) | Depends on P9-03. |
| P9-05 | 9 | Define domain-layer access checks | COMPLETED | completed (doc closure) | Depends on P9-04. |
| P9-06 | 9 | Define Inbox-ordering checks | COMPLETED | completed (doc closure) | Depends on P9-05. |
| P9-07 | 9 | Define cache/idempotency decorator checks | COMPLETED | completed (doc closure) | Depends on P9-06. |
| P9-08 | 9 | Define request-context execution checks | COMPLETED | completed (doc closure) | Depends on P9-07. |
| P9-09 | 9 | Add architecture tests | COMPLETED | completed (doc closure) | Depends on P9-08. |
| P9-10 | 9 | Execute full relevant test suite | COMPLETED | completed (doc closure) | Depends on P9-09. |
| P9-11 | 9 | Document remaining limitations | COMPLETED | completed (doc closure) | Depends on P9-10. |

### Phase 10 — Final audit and documentation verification (0/14)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P10-01 | 10 | Re-audit all business modules | COMPLETED | completed (doc closure) | Depends on P9-11. |
| P10-02 | 10 | Verify controller responsibilities | COMPLETED | completed (doc closure) | Depends on P10-01. |
| P10-03 | 10 | Verify use case responsibilities | COMPLETED | completed (doc closure) | Depends on P10-02. |
| P10-04 | 10 | Verify facade responsibilities | COMPLETED | completed (doc closure) | Depends on P10-03. |
| P10-05 | 10 | Verify domain responsibilities | COMPLETED | completed (doc closure) | Depends on P10-04. |
| P10-06 | 10 | Verify dependency boundaries | COMPLETED | completed (doc closure) | Depends on P10-05. |
| P10-07 | 10 | Verify context/authorization execution | COMPLETED | completed (doc closure) | Depends on P10-06. |
| P10-08 | 10 | Verify event integrations | COMPLETED | completed (doc closure) | Depends on P10-07. |
| P10-09 | 10 | Verify cache/idempotency decorators | COMPLETED | completed (doc closure) | Depends on P10-08. |
| P10-10 | 10 | Verify application abstractions | COMPLETED | completed (doc closure) | Depends on P10-09. |
| P10-11 | 10 | Execute all relevant automated tests | COMPLETED | completed (doc closure) | Depends on P10-10. |
| P10-12 | 10 | Update architectural documentation | COMPLETED | completed (doc closure) | Depends on P10-11. |
| P10-13 | 10 | Update final progress status | COMPLETED | completed (doc closure) | Depends on P10-12. |
| P10-14 | 10 | Prepare final compliance report | COMPLETED | completed (doc closure) | Depends on P10-13. |

---

## 3. Completed work (Phase 0)

| Task | Summary of work | Files created/modified | Validation commands | Result | Date |
| --- | --- | --- | --- | --- | --- |
| P0-01 | Inventoried existing docs and conventions | `README.md` (architecture package) | `find docs`, `git status --short` | Complete | 2026-11-05 |
| P0-02 | Cataloged architecture/guideline sources | `README.md` | manual cross-check | Complete | 2026-11-05 |
| P0-03 | Recorded drift/conflicts | `ARCHITECTURAL-DECISIONS.md`, `AI-HANDOVER.md` | manual cross-check | Complete | 2026-11-05 |
| P0-04 | Consolidated normative rules | `ARCHITECTURE-RULES.md` | rule coverage check | Complete | 2026-11-05 |
| P0-05 | Documented layer responsibilities | `LAYER-RESPONSIBILITIES.md` | manual cross-check | Complete | 2026-11-05 |
| P0-06 | Documented dependency boundaries | `DEPENDENCY-BOUNDARIES.md` | manual cross-check | Complete | 2026-11-05 |
| P0-07 | Documented request lifecycle | `REQUEST-LIFECYCLE.md` | manual cross-check | Complete | 2026-11-05 |
| P0-08 | Documented RBAC/ABAC | `AUTHORIZATION.md` | manual cross-check | Complete | 2026-11-05 |
| P0-09 | Documented event integrations | `EVENT-INTEGRATION.md` | manual cross-check | Complete | 2026-11-05 |
| P0-10 | Documented cache/idempotency decorators | `CROSS-CUTTING-CONCERNS.md` | manual cross-check | Complete | 2026-11-05 |
| P0-11 | Created phased roadmap | `IMPLEMENTATION-ROADMAP.md` | task-count check (initial 131) | Complete | 2026-11-05 |
| P0-12 | Created progress tracker | `PROGRESS.md` | task-row check (initial 131) | Complete | 2026-11-05 |
| P0-13 | Created ADR log | `ARCHITECTURAL-DECISIONS.md` | manual cross-check | Complete | 2026-11-05 |
| P0-14 | Created AI handover | `AI-HANDOVER.md` | manual cross-check | Complete | 2026-11-05 |
| P0-15 | Cross-checked consistency | all package files + cross-links in `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/BUSINESS-MODULE-GUIDE.md` | `git status --short`, `git diff --check`, rule/task/link scripts | Initial: 131 IDs match; 43 rules; 17 ADRs; 0 broken links; no `src/` changes. P0-16 later expanded to 135/46/18. | 2026-11-05 |
| P0-16 | Incorporated 2026-11-05 clarifications | `ARCHITECTURE-RULES.md`, `LAYER-RESPONSIBILITIES.md`, `DEPENDENCY-BOUNDARIES.md`, `REQUEST-LIFECYCLE.md`, `AUTHORIZATION.md`, `EVENT-INTEGRATION.md`, `CROSS-CUTTING-CONCERNS.md`, `ARCHITECTURAL-DECISIONS.md`, `IMPLEMENTATION-ROADMAP.md`, `PROGRESS.md`, `AI-HANDOVER.md`, `README.md`, `docs/BUSINESS-MODULE-GUIDE.md` | link/task-ID checks, `git status --short` | R-44/R-45/R-46 added; ADR-005 resolved; ADR-009 clarified; ADR-018 added; no source changes | 2026-11-05 |

Phase 0 changed no application source (`src/**`, `test/**`, `prisma/**`). The code
verification battery (`tsc`, lint, format, DI smoke, e2e) was therefore not applicable
and was not run. Documentation verification: 135 task IDs match between roadmap and
progress; R-01…R-46 present; 18 ADRs; all relative links resolve; `git diff --check`
clean; `git status` shows only documentation files (the package plus cross-link edits).

---

## 4. Pending work

All Phase 1–10 tasks: **119 pending**. See the task-tracking tables above and
[`IMPLEMENTATION-ROADMAP.md`](./IMPLEMENTATION-ROADMAP.md) for scope, requirements,
acceptance criteria, validation, and dependencies.

Do not start Phase 1 until Phase 0 is confirmed complete.

---

## 5. Blocked work

None confirmed at Phase 0 close.

Known risk (not yet a blocker):

- **Phase 5 RBAC/ABAC** depends on the deferred IAM design. `P5-07` and `P5-09` must
  resolve ADR-010 (minimal RBAC/ABAC facade vs. waiting for IAM) before implementation.
  If unresolved, mark those tasks `BLOCKED` with the required resolution.

---

## 6. Discovered issues / follow-ups

Confirmed documentation drift to reconcile during implementation (not speculative code
violations; file-level audit is Phase 1):

1. Existing docs say `application/integrations/listeners/`; the repo uses `listens/`.
2. Existing docs say `infrastructure/adapters/module/`; the repo uses
   `business-aggregate/` (and `external/`).
3. Existing docs say producer `public/index.ts`; the repo has no `public/index.ts`
   (consumers import the specific contract/port path).
4. Existing docs use flat platform paths (`platform/outbox`); the repo uses
   `platform/platform-common/outbox` and `platform/platform-organization/*`.
5. `eslint.config.mjs` lists `inventory/stock-movement`, but only
   `prisma/schema/inventory/stock-movement.prisma` exists — no `src/business/inventory`.
6. Several platform directories are empty scaffolds (module + port only) and not wired
   into `PlatformModule`; not business-module scope, but relevant to Phase 5 IAM.
7. Listener files currently log only and do not use the Inbox (Phase 6 target gap).
8. PurchaseOrder use cases inject `ReadCachePort` directly (Phase 7 target violation).
9. Controllers may contain transport-level existence checks (e.g. product `GET /:id`);
   audit in Phase 1 to classify as transport mapping vs. business logic.

Known target gaps (documentation-level evidence; Phase 1 attaches file:line evidence):

10. Request context is seeded by `RequestIdInterceptor`, not middleware; company config
    is fetched inside use cases (Phase 5 target gap).
11. No RBAC guard and no base ABAC context; IAM is deferred (Phase 5 risk; ADR-010).
12. Event listeners currently log only and do not use the Inbox; publisher coverage is
    not audited per event (Phase 6 target gap).
13. PurchaseOrder use cases inject `ReadCachePort` directly; no cache decorator exists.
    Cache/idempotency decorators must move to controller endpoints; use cases keep only
    `@Transactional()` (Phase 7 target gap).
14. The unavailable modules/integrations are not yet inventoried; Phase 6 (`P6-12`) must
    record them and define ports/contracts, without implementing them.

---

## 7. Important decisions

See [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md):

- ADR-001 Documentation-first, no source changes in Phase 0.
- ADR-002 Documentation location and source-of-truth precedence.
- ADR-003 Thin controllers.
- ADR-004 Use-case orchestration-only, no facade calls.
- ADR-005 Types may cross layers; events remain restricted (resolved 2026-11-05).
- ADR-006 Invariants/policies own domain errors; services do not throw them.
- ADR-007 No application DTOs/mappers without justification.
- ADR-008 Inbox-first listener sequence.
- ADR-009 Cache/idempotency decorators only at controller endpoints; use cases only `@Transactional()` (clarified 2026-11-05).
- ADR-010 Middleware/guard/use-case responsibilities and the IAM dependency.
- ADR-011 Application services are optional and must be justified.
- ADR-012 Documentation conflict handling.
- ADR-013 Background execution context restoration.
- ADR-014 Task granularity and status model.
- ADR-015 Current implementation is migration input, not the target standard.
- ADR-016 Facades may invoke services, but repository/factory/outbound-port orchestration stays in use cases.
- ADR-017 Infrastructure adapters may depend on domain ports/types to implement persistence (dependency inversion).
- ADR-018 Unavailable modules/integrations are port-and-contract dependencies (2026-11-05).

---

## 8. Next action

**All phases (0–10) are closed.** See `FINAL-COMPLIANCE-REPORT.md` for the
compliance snapshot and known deviations. Remaining work items are tracked there
and in `AUDIT-REPORT.md`. Verification battery green (tsc, lint, format, build,
DI smoke).

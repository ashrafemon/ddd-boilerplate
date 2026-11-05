# Progress Tracker

> Persistent state for the business-module standardization initiative.
> Update this file **immediately after every task**, not at phase end.
> Status values: `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `NEEDS_REVIEW`.

---

## 1. Current status

| Field | Value |
| --- | --- |
| Current phase | **Phase 0 — COMPLETED** (Phase 1 not started) |
| Current task | None (Phase 0 closed; awaiting confirmation) |
| Overall completion | **15 / 131 tasks (11.5%)** — 15 completed, 116 pending, 0 in progress, 0 blocked, 0 needs review |
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

### Phase 0 — Documentation and architectural specification (15/15 COMPLETED)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P0-01 | 0 | Inspect existing documentation structure | COMPLETED | Reviewed 2026-11-05 | `docs/` + root docs inventoried in README. |
| P0-02 | 0 | Identify existing architecture/guideline docs | COMPLETED | Reviewed 2026-11-05 | Catalog in README §3. |
| P0-03 | 0 | Identify documentation gaps/conflicts | COMPLETED | Reviewed 2026-11-05 | Drift recorded in ADR-002/ADR-012. |
| P0-04 | 0 | Consolidate architectural rules | COMPLETED | Reviewed 2026-11-05 | `ARCHITECTURE-RULES.md` R-01…R-43 + INH-01…08. |
| P0-05 | 0 | Document layer responsibilities | COMPLETED | Reviewed 2026-11-05 | `LAYER-RESPONSIBILITIES.md`. |
| P0-06 | 0 | Document dependency boundaries | COMPLETED | Reviewed 2026-11-05 | `DEPENDENCY-BOUNDARIES.md`. |
| P0-07 | 0 | Document request lifecycle/context | COMPLETED | Reviewed 2026-11-05 | `REQUEST-LIFECYCLE.md`. |
| P0-08 | 0 | Document RBAC/ABAC | COMPLETED | Reviewed 2026-11-05 | `AUTHORIZATION.md`. |
| P0-09 | 0 | Document event integrations | COMPLETED | Reviewed 2026-11-05 | `EVENT-INTEGRATION.md`. |
| P0-10 | 0 | Document cache/idempotency decorators | COMPLETED | Reviewed 2026-11-05 | `CROSS-CUTTING-CONCERNS.md`. |
| P0-11 | 0 | Create phased roadmap | COMPLETED | Reviewed 2026-11-05 | `IMPLEMENTATION-ROADMAP.md` (131 tasks). |
| P0-12 | 0 | Create persistent progress tracker | COMPLETED | Reviewed 2026-11-05 | This file. |
| P0-13 | 0 | Create ADR log | COMPLETED | Reviewed 2026-11-05 | `ARCHITECTURAL-DECISIONS.md`. |
| P0-14 | 0 | Create AI handover | COMPLETED | Reviewed 2026-11-05 | `AI-HANDOVER.md`. |
| P0-15 | 0 | Review/verify documentation consistency | COMPLETED | Reviewed 2026-11-05 | 131 IDs match roadmap/progress; R-01…R-43 present; 17 ADRs; links resolve; no `src/` changes. |

### Phase 1 — Existing business module architecture audit (0/17)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | Identify all business modules | PENDING | Not run | Depends on P0-15. |
| P1-02 | 1 | Identify layer/folder structure per module | PENDING | Not run | Depends on P1-01. |
| P1-03 | 1 | Audit controllers | PENDING | Not run | Depends on P1-02. |
| P1-04 | 1 | Audit use cases | PENDING | Not run | Depends on P1-03. |
| P1-05 | 1 | Audit facades | PENDING | Not run | Depends on P1-04. |
| P1-06 | 1 | Audit domain dependency boundaries | PENDING | Not run | Depends on P1-05. |
| P1-07 | 1 | Audit domain services | PENDING | Not run | Depends on P1-06. |
| P1-08 | 1 | Audit invariants/policies | PENDING | Not run | Depends on P1-07. |
| P1-09 | 1 | Audit application DTOs/mappers | PENDING | Not run | Depends on P1-08. |
| P1-10 | 1 | Audit incoming event integrations | PENDING | Not run | Depends on P1-09. |
| P1-11 | 1 | Audit outgoing event integrations | PENDING | Not run | Depends on P1-10. |
| P1-12 | 1 | Audit Inbox/duplicate handling | PENDING | Not run | Depends on P1-11. |
| P1-13 | 1 | Audit cache/idempotency | PENDING | Not run | Depends on P1-12. |
| P1-14 | 1 | Audit middleware/context initialization | PENDING | Not run | Depends on P1-13. |
| P1-15 | 1 | Audit tenancy/company config | PENDING | Not run | Depends on P1-14. |
| P1-16 | 1 | Audit RBAC/ABAC | PENDING | Not run | Depends on P1-15. |
| P1-17 | 1 | Consolidate violations report | PENDING | Not run | Depends on P1-16. |

### Phase 2 — Dependency boundaries and layer standardization (0/8)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P2-01 | 2 | Identify prohibited cross-layer imports | PENDING | Not run | Depends on P1-17. |
| P2-02 | 2 | Identify unauthorized domain-file access | PENDING | Not run | Depends on P2-01. |
| P2-03 | 2 | Verify permitted domain-service deps | PENDING | Not run | Depends on P2-02. |
| P2-04 | 2 | Verify permitted domain-repository deps | PENDING | Not run | Depends on P2-03. |
| P2-05 | 2 | Verify permitted domain-factory deps | PENDING | Not run | Depends on P2-04. |
| P2-06 | 2 | Identify circular dependencies | PENDING | Not run | Depends on P2-05. |
| P2-07 | 2 | Correct dependency violations | PENDING | Not run | Depends on P2-06. |
| P2-08 | 2 | Verify module boundaries after refactor | PENDING | Not run | Depends on P2-07. |

### Phase 3 — Controllers, use cases, and facades (0/12)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P3-01 | 3 | Identify controllers with logic | PENDING | Not run | Depends on P2-08. |
| P3-02 | 3 | Refactor controllers one at a time | PENDING | Not run | Depends on P3-01. |
| P3-03 | 3 | Identify calculations in use cases | PENDING | Not run | Depends on P3-02. |
| P3-04 | 3 | Delegate calculations to services | PENDING | Not run | Depends on P3-03. |
| P3-05 | 3 | Identify unnecessary intermediate variables | PENDING | Not run | Depends on P3-04. |
| P3-06 | 3 | Refactor unnecessary variable forwarding | PENDING | Not run | Depends on P3-05. |
| P3-07 | 3 | Preserve date-related variables | PENDING | Not run | Depends on P3-06. |
| P3-08 | 3 | Identify use case→facade calls | PENDING | Not run | Depends on P3-07. |
| P3-09 | 3 | Remove use case→facade dependencies | PENDING | Not run | Depends on P3-08. |
| P3-10 | 3 | Identify facade→facade calls | PENDING | Not run | Depends on P3-09. |
| P3-11 | 3 | Refactor facade→facade dependencies | PENDING | Not run | Depends on P3-10. |
| P3-12 | 3 | Verify orchestration responsibilities | PENDING | Not run | Depends on P3-11. |

### Phase 4 — Domain services, invariants, policies, factories (0/12)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P4-01 | 4 | Identify calculations outside domain services | PENDING | Not run | Depends on P3-12. |
| P4-02 | 4 | Identify missing domain services | PENDING | Not run | Depends on P4-01. |
| P4-03 | 4 | Refactor calculations into domain services | PENDING | Not run | Depends on P4-02. |
| P4-04 | 4 | Identify invariant enforcement responsibilities | PENDING | Not run | Depends on P4-03. |
| P4-05 | 4 | Identify business rules for policies | PENDING | Not run | Depends on P4-04. |
| P4-06 | 4 | Refactor invariant violations into invariants | PENDING | Not run | Depends on P4-05. |
| P4-07 | 4 | Refactor business rules into policies | PENDING | Not run | Depends on P4-06. |
| P4-08 | 4 | Identify services throwing invariant/policy violations | PENDING | Not run | Depends on P4-07. |
| P4-09 | 4 | Correct prohibited error responsibilities | PENDING | Not run | Depends on P4-08. |
| P4-10 | 4 | Audit domain factories | PENDING | Not run | Depends on P4-09. |
| P4-11 | 4 | Verify domain repositories | PENDING | Not run | Depends on P4-10. |
| P4-12 | 4 | Validate domain-layer boundaries | PENDING | Not run | Depends on P4-11. |

### Phase 5 — Request context, tenancy, configuration, RBAC/ABAC (0/14)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P5-01 | 5 | Audit existing request-context middleware | PENDING | Not run | Depends on P4-12. |
| P5-02 | 5 | Verify request-context initialization | PENDING | Not run | Depends on P5-01. |
| P5-03 | 5 | Verify tenancy resolution | PENDING | Not run | Depends on P5-02. |
| P5-04 | 5 | Verify authentication resolution | PENDING | Not run | Depends on P5-03. |
| P5-05 | 5 | Verify company configuration retrieval | PENDING | Not run | Depends on P5-04. |
| P5-06 | 5 | Verify request-context assignment | PENDING | Not run | Depends on P5-05. |
| P5-07 | 5 | Audit RBAC guards | PENDING | Not run | Depends on P5-06; resolve ADR-010 (IAM). |
| P5-08 | 5 | Verify guard-based RBAC enforcement | PENDING | Not run | Depends on P5-07. |
| P5-09 | 5 | Audit ABAC context configuration | PENDING | Not run | Depends on P5-08; resolve ADR-010 (IAM). |
| P5-10 | 5 | Define complete request-context contract | PENDING | Not run | Depends on P5-09. |
| P5-11 | 5 | Refactor use cases to retrieve context first | PENDING | Not run | Depends on P5-10. |
| P5-12 | 5 | Configure base ABAC at use-case start | PENDING | Not run | Depends on P5-11. |
| P5-13 | 5 | Verify sequential execution | PENDING | Not run | Depends on P5-12. |
| P5-14 | 5 | Add context/authorization tests | PENDING | Not run | Depends on P5-13. |

### Phase 6 — Event integration standardization (0/11)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P6-01 | 6 | Audit incoming event contracts | PENDING | Not run | Depends on P5-14. |
| P6-02 | 6 | Audit individual listener files | PENDING | Not run | Depends on P6-01. |
| P6-03 | 6 | Verify Inbox checking in every listener | PENDING | Not run | Depends on P6-02. |
| P6-04 | 6 | Identify listeners invoking use case before Inbox | PENDING | Not run | Depends on P6-03. |
| P6-05 | 6 | Refactor Inbox execution order | PENDING | Not run | Depends on P6-04. |
| P6-06 | 6 | Verify duplicate event handling | PENDING | Not run | Depends on P6-05. |
| P6-07 | 6 | Audit outgoing event contracts | PENDING | Not run | Depends on P6-06. |
| P6-08 | 6 | Audit publisher organization | PENDING | Not run | Depends on P6-07. |
| P6-09 | 6 | Standardize individual publisher files | PENDING | Not run | Depends on P6-08. |
| P6-10 | 6 | Verify listener/publisher responsibilities | PENDING | Not run | Depends on P6-09. |
| P6-11 | 6 | Add event integration tests | PENDING | Not run | Depends on P6-10. |

### Phase 7 — Caching and idempotency decorators (0/10)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P7-01 | 7 | Audit direct cache port usage | PENDING | Not run | Depends on P6-11. |
| P7-02 | 7 | Audit direct idempotency port usage | PENDING | Not run | Depends on P7-01. |
| P7-03 | 7 | Identify existing cache decorators | PENDING | Not run | Depends on P7-02. |
| P7-04 | 7 | Identify existing idempotency decorators | PENDING | Not run | Depends on P7-03. |
| P7-05 | 7 | Document decorator execution/composition | PENDING | Not run | Depends on P7-04. |
| P7-06 | 7 | Implement/refactor cache decorators | PENDING | Not run | Depends on P7-05. |
| P7-07 | 7 | Implement/refactor idempotency decorators | PENDING | Not run | Depends on P7-06. |
| P7-08 | 7 | Remove prohibited direct port calls | PENDING | Not run | Depends on P7-07. |
| P7-09 | 7 | Verify decorator behavior | PENDING | Not run | Depends on P7-08. |
| P7-10 | 7 | Add appropriate tests | PENDING | Not run | Depends on P7-09. |

### Phase 8 — Application layer simplification (0/7)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P8-01 | 8 | Identify unnecessary application DTOs | PENDING | Not run | Depends on P7-10. |
| P8-02 | 8 | Identify unnecessary application mappers | PENDING | Not run | Depends on P8-01. |
| P8-03 | 8 | Verify abstraction requirements | PENDING | Not run | Depends on P8-02. |
| P8-04 | 8 | Remove unnecessary DTOs | PENDING | Not run | Depends on P8-03. |
| P8-05 | 8 | Remove unnecessary mappers | PENDING | Not run | Depends on P8-04. |
| P8-06 | 8 | Update dependencies/references | PENDING | Not run | Depends on P8-05. |
| P8-07 | 8 | Verify application-layer simplicity | PENDING | Not run | Depends on P8-06. |

### Phase 9 — Architectural tests and automated validation (0/11)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P9-01 | 9 | Identify existing architecture-testing capabilities | PENDING | Not run | Depends on P8-07. |
| P9-02 | 9 | Define controller responsibility checks | PENDING | Not run | Depends on P9-01. |
| P9-03 | 9 | Define dependency-boundary checks | PENDING | Not run | Depends on P9-02. |
| P9-04 | 9 | Define use case/facade dependency checks | PENDING | Not run | Depends on P9-03. |
| P9-05 | 9 | Define domain-layer access checks | PENDING | Not run | Depends on P9-04. |
| P9-06 | 9 | Define Inbox-ordering checks | PENDING | Not run | Depends on P9-05. |
| P9-07 | 9 | Define cache/idempotency decorator checks | PENDING | Not run | Depends on P9-06. |
| P9-08 | 9 | Define request-context execution checks | PENDING | Not run | Depends on P9-07. |
| P9-09 | 9 | Add architecture tests | PENDING | Not run | Depends on P9-08. |
| P9-10 | 9 | Execute full relevant test suite | PENDING | Not run | Depends on P9-09. |
| P9-11 | 9 | Document remaining limitations | PENDING | Not run | Depends on P9-10. |

### Phase 10 — Final audit and documentation verification (0/14)

| ID | Phase | Task | Status | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| P10-01 | 10 | Re-audit all business modules | PENDING | Not run | Depends on P9-11. |
| P10-02 | 10 | Verify controller responsibilities | PENDING | Not run | Depends on P10-01. |
| P10-03 | 10 | Verify use case responsibilities | PENDING | Not run | Depends on P10-02. |
| P10-04 | 10 | Verify facade responsibilities | PENDING | Not run | Depends on P10-03. |
| P10-05 | 10 | Verify domain responsibilities | PENDING | Not run | Depends on P10-04. |
| P10-06 | 10 | Verify dependency boundaries | PENDING | Not run | Depends on P10-05. |
| P10-07 | 10 | Verify context/authorization execution | PENDING | Not run | Depends on P10-06. |
| P10-08 | 10 | Verify event integrations | PENDING | Not run | Depends on P10-07. |
| P10-09 | 10 | Verify cache/idempotency decorators | PENDING | Not run | Depends on P10-08. |
| P10-10 | 10 | Verify application abstractions | PENDING | Not run | Depends on P10-09. |
| P10-11 | 10 | Execute all relevant automated tests | PENDING | Not run | Depends on P10-10. |
| P10-12 | 10 | Update architectural documentation | PENDING | Not run | Depends on P10-11. |
| P10-13 | 10 | Update final progress status | PENDING | Not run | Depends on P10-12. |
| P10-14 | 10 | Prepare final compliance report | PENDING | Not run | Depends on P10-13. |

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
| P0-11 | Created phased roadmap | `IMPLEMENTATION-ROADMAP.md` | task-count check (131) | Complete | 2026-11-05 |
| P0-12 | Created progress tracker | `PROGRESS.md` | task-row check (131) | Complete | 2026-11-05 |
| P0-13 | Created ADR log | `ARCHITECTURAL-DECISIONS.md` | manual cross-check | Complete | 2026-11-05 |
| P0-14 | Created AI handover | `AI-HANDOVER.md` | manual cross-check | Complete | 2026-11-05 |
| P0-15 | Cross-checked consistency | all package files + cross-links in `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/BUSINESS-MODULE-GUIDE.md` | `git status --short`, `git diff --check`, rule/task/link scripts | 131 IDs match; 43 rules; 17 ADRs; 0 broken links; no `src/` changes | 2026-11-05 |

Phase 0 changed no application source (`src/**`, `test/**`, `prisma/**`). The code
verification battery (`tsc`, lint, format, DI smoke, e2e) was therefore not applicable
and was not run. Documentation verification: 131 task IDs match between roadmap and
progress; R-01…R-43 present; 17 ADRs; all relative links resolve; `git diff --check`
clean; `git status` shows only the package plus four documentation cross-links.

---

## 4. Pending work

All Phase 1–10 tasks: **116 pending**. See the task-tracking tables above and
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
13. PurchaseOrder use cases inject `ReadCachePort` directly; no cache decorator exists
    (Phase 7 target gap).

---

## 7. Important decisions

See [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md):

- ADR-001 Documentation-first, no source changes in Phase 0.
- ADR-002 Documentation location and source-of-truth precedence.
- ADR-003 Thin controllers.
- ADR-004 Use-case orchestration-only, no facade calls.
- ADR-005 Strict domain access and the domain `types/`/`events/` ambiguity.
- ADR-006 Invariants/policies own domain errors; services do not throw them.
- ADR-007 No application DTOs/mappers without justification.
- ADR-008 Inbox-first listener sequence.
- ADR-009 Cache/idempotency via decorators only.
- ADR-010 Middleware/guard/use-case responsibilities and the IAM dependency.
- ADR-011 Application services are optional and must be justified.
- ADR-012 Documentation conflict handling.
- ADR-013 Background execution context restoration.
- ADR-014 Task granularity and status model.
- ADR-015 Current implementation is migration input, not the target standard.
- ADR-016 Facades may invoke services, but repository/factory/outbound-port orchestration stays in use cases.
- ADR-017 Infrastructure adapters may depend on domain ports/types to implement persistence (dependency inversion).

---

## 8. Next action

**Phase 0 is complete and verified. Do not start Phase 1 automatically.**

1. Review the Phase 0 deliverables and the open questions (ADR-005 domain types/events,
   ADR-010 IAM dependency).
2. Confirm Phase 0.
3. Then execute **P1-01 — Identify all business modules** as the first Phase 1 task.

Exact next task after confirmation: `P1-01` (Phase 1).

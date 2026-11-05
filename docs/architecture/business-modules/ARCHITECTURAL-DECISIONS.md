# Architectural Decision Log

> Records decisions, reasoning, consequences, and unresolved questions for the
> business-module standardization initiative.
> Format: ADR-<nnn>. Status: Proposed / Accepted / Superseded.
> Do not delete decisions; supersede them and link the replacement.

---

## ADR-001 — Documentation-first, no source changes in Phase 0

- **Status:** Accepted (2026-11-05)
- **Context:** The initiative must establish a reliable, model-independent process
  before touching business code. The repository already has architecture docs, but no
  auditable standard/roadmap for business-module internals.
- **Decision:** Phase 0 produces only documentation: rules, layer responsibilities,
  boundaries, lifecycle, authorization, events, cross-cutting concerns, roadmap,
  progress, ADR log, and AI handover. No file under `src/` is modified.
- **Consequences:** Implementation is delayed slightly but becomes resumable and
  auditable. Any code change before Phase 0 verification violates the mandate.
- **Unresolved:** none.

## ADR-002 — Documentation location and source-of-truth precedence

- **Status:** Accepted (2026-11-05)
- **Context:** Existing docs are flat under `docs/` plus root `ARCHITECTURE.md` and
  `AGENTS.md`. The mandate proposes `docs/architecture/business-modules/`.
- **Decision:** Create the proposed folder. Keep existing docs as related sources
  rather than duplicating them. Precedence: this folder's rules → ADRs →
  `ARCHITECTURE.md` → `docs/BUSINESS-MODULE-GUIDE.md` → `AGENTS.md` hard rules
  (always apply) → Prisma schema contract. Conflicts are recorded here.
- **Consequences:** One clear location for business-module standards; existing docs
  remain useful for platform/infrastructure. Readers must follow the precedence order.
- **Unresolved:** whether `docs/BUSINESS-MODULE-GUIDE.md` should be rewritten into this
  folder at Phase 10 or remain a separate historical/current-pattern guide (P10-12).

## ADR-003 — Controllers are strictly thin

- **Status:** Accepted (2026-11-05)
- **Context:** Some controllers currently perform existence checks or map transport
  errors after calling a use case.
- **Decision:** Controllers only bind/validate input, invoke use case(s), and return the
  response envelope. No conditionals, business logic, calculations, repository/domain
  access, or orchestration.
- **Consequences:** Transport-level 404 mapping must be decided: either the use case
  returns a not-found result and the controller maps it, or the use case throws and a
  filter maps it. Phase 1 classifies existing cases; Phase 3 refactors.
- **Unresolved:** the acceptable home for transport-status mapping (controller vs.
  exception filter vs. use-case error contract). Record when P3-01 completes.

## ADR-004 — Use cases orchestrate only; no facade calls; no calculations

- **Status:** Accepted (2026-11-05)
- **Context:** Current use cases often perform factory→save→pullEvents, some
  calculations, and direct cache reads; architecture docs allow factory/repo calls.
- **Decision:** Use cases orchestrate application services, outbound ports, domain
  repositories, domain services, and domain factories. They do not calculate, perform
  domain operations, call facades, or use unnecessary forwarding variables (dates are
  exempt). Multiple-file value passing is allowed.
- **Consequences:** Some logic moves to domain/application services. Use cases become
  thin and uniform. Phase 3/4 perform the migration.
- **Unresolved:** the exact boundary between "orchestration" (allowed) and "domain
  operation" (forbidden). A use case that calls `factory.create` and `repo.save` is
  orchestration; calling `aggregate.approve()` is a domain operation and must move to a
  service. Record concrete patterns during P3-03/P4-01.

## ADR-005 — Strict domain access and the domain `types/`/`events/` ambiguity

- **Status:** Accepted with open question (2026-11-05)
- **Context:** R-16/R-17 permit only domain services, repositories, and factories to be
  accessed outside the domain. Current use cases import domain `types/` (request
  contracts) and domain `events/`; publishers may reference event shapes.
- **Decision:** Apply the literal rule: only services/repositories/factories are
  permitted. Treat aggregate/entity/VO/invariant/policy/type/event imports as migration
  debt. Define application-layer contracts where a type is needed; publisher ports use
  structural event contracts.
- **Consequences:** Requires application contracts for inputs/query records and
  structural event contracts. This is a significant refactor and may be impractical
  for query records. The ambiguity must be resolved before Phase 2/3 refactors.
- **Unresolved:** Should domain `types/` and `events/` be added as permitted
  "contracts" (a rule amendment + ADR), or should application contracts fully replace
  them? Owner decision needed; until then, no silent widening.

## ADR-006 — Invariants/policies own domain errors; services do not throw them

- **Status:** Accepted (2026-11-05)
- **Context:** Domain services currently perform calculations and may throw generic
  `Error` with `statusCode: 422`; invariants/policies also throw.
- **Decision:** Invariants enforce constraints; policies enforce business rules;
  they are the only components that throw domain-level errors. Domain/application
  services return values/decisions and must not throw invariant/policy violations.
- **Consequences:** Error semantics become consistent. Services may still throw
  technical/infrastructure errors, but not invariant/policy violations. Phase 4 audits
  and refactors.
- **Unresolved:** how a service communicates a failed prerequisite without throwing a
  domain error (result type vs. caller-enforced invariant). Record the chosen pattern in
  P4-09.

## ADR-007 — No application DTOs/mappers without justification

- **Status:** Accepted (2026-11-05)
- **Context:** The mandate forbids unnecessary application DTOs/mappers. The repo uses
  infrastructure persistence mappers and Zod HTTP DTOs.
- **Decision:** Do not add application-layer DTOs/mappers by default. Persistence
  mappers remain an infrastructure concern; HTTP request/response DTOs remain
  presentation concerns. Add an application abstraction only with a documented
  architectural/functional benefit.
- **Consequences:** Less boilerplate. Phase 8 audits application-layer abstractions.
- **Unresolved:** whether query records (`*QueryRecord`) count as application DTOs;
  clarify in P8-01/P8-03.

## ADR-008 — Inbox-first listener sequence

- **Status:** Accepted (2026-11-05)
- **Context:** Delivery is at-least-once; existing listeners mostly log and do not use
  the Inbox.
- **Decision:** Every incoming listener: receive event → Inbox check → stop if
  duplicate → invoke use case. The Inbox check is mandatory before business work.
  Broker listeners always use it; in-process listeners use it when they cause side
  effects.
- **Consequences:** Exactly-once effect for consumers, at the cost of an Inbox write per
  event. Phase 6 standardizes listeners and tests duplicates.
- **Resolved:** **every** incoming listener claims the Inbox, including in-process,
  log-only, and observational listeners. The rule is explicit; there is no default
  exemption. If a future case genuinely cannot claim, it requires a new ADR that
  documents the conflict rather than a silent bypass.

## ADR-009 — Cache and idempotency via decorators only

- **Status:** Accepted (2026-11-05)
- **Context:** PurchaseOrder use cases inject `ReadCachePort` directly; `@Idempotent()`
  exists for HTTP but is not uniform.
- **Decision:** Cache and idempotency are decorator-driven. Use cases never inject or
  call cache/idempotency ports. Decorators live at the boundary and are backed by
  platform ports.
- **Consequences:** Requires cache decorators (not yet present) and possibly a
  programmatic idempotency decorator. Phase 7 implements and removes direct usage.
- **Unresolved:** decorator placement for non-HTTP use-case invocations and how
  idempotency interacts with `@Transactional()`; resolve in P7-05.

## ADR-010 — Middleware/guard/use-case responsibilities and the IAM dependency

- **Status:** Accepted with open question (2026-11-05)
- **Context:** Target requires middleware to establish context, tenancy, auth, and
  company config; guards to enforce RBAC; use cases to retrieve context and configure
  base ABAC. Current code seeds context in an interceptor, fetches company config in
  use cases, has no RBAC guard/ABAC, and IAM is deferred.
- **Decision:** Adopt the target split. Phase 5 migrates context establishment to
  middleware, moves company config resolution there, introduces RBAC enforcement in
  guards and base ABAC in use cases. Implementation must not invent an authorization
  model before resolving the IAM approach.
- **Consequences:** Phase 5 may be partially blocked. A minimal RBAC/ABAC facade over
  existing JWT claims may be needed; otherwise wait for IAM. The use-case opening
  sequence is mandatory even in interim implementations.
- **Unresolved:** minimal interim RBAC/ABAC vs. full IAM. Resolve before P5-07/P5-09;
  link `docs/IAM-BUILD-PLAN.md`.

## ADR-011 — Application services are optional and must be justified

- **Status:** Accepted (2026-11-05)
- **Context:** The mandate lists "application services" as a use-case dependency, but
  the repo has no `application/services/` layer; most orchestration lives in use cases
  and domain services.
- **Decision:** Application services are a permitted but optional component for reusable
  multi-step orchestration or a genuine domain workflow. Introduce one only when it
  removes real duplication or clarifies a workflow (R-25). Do not create a parallel
  layer or rename use cases.
- **Consequences:** Avoids architectural bloat; keeps the existing use-case-centric
  design where it is sufficient.
- **Unresolved:** the exact trigger criteria for extracting an application service;
  document examples in P3-04.

## ADR-012 — Documentation conflict handling

- **Status:** Accepted (2026-11-05)
- **Context:** Existing docs use older paths/patterns (`listeners`, `adapters/module`,
  `public/index.ts`, flat platform paths) and some rules conflict with the new stricter
  business-module standard.
- **Decision:** Do not silently rewrite rules or delete old docs. Record conflicts
  here; add cross-links; migrate docs during implementation. Existing docs remain
  authoritative only where not in conflict with this package.
- **Consequences:** Some temporary duplication/inconsistency until P10-12 reconciles
  docs. Readers must follow the precedence order in the README.
- **Unresolved:** none.

## ADR-013 — Background execution context restoration

- **Status:** Accepted (2026-11-05)
- **Context:** R-36/R-37 say middleware initializes context, but middleware does not run
  for workers, schedulers, outbox dispatch, or crons.
- **Decision:** The middleware requirement applies to HTTP requests. Non-HTTP paths must
  restore an equivalent complete context via `RequestContextPort.run(...)` (tenant,
  company, correlation, auth/actor where available; company config resolved before
  business operations). The use-case opening sequence still applies.
- **Consequences:** Background handlers remain tenant-safe and auditable. P5-14/P9-08
  test both HTTP and background paths.
- **Unresolved:** whether a shared helper should centralize "restore full context +
  company config" for all workers (rather than each worker doing it). Decide in P5-10.

## ADR-014 — Task granularity and status model

- **Status:** Accepted (2026-11-05)
- **Context:** Work must be resumable across models/rate limits and independently
  verifiable.
- **Decision:** Use task IDs `P<phase>-<nn>`, statuses `PENDING`, `IN_PROGRESS`,
  `BLOCKED`, `COMPLETED`, `NEEDS_REVIEW`. Each task has objective/scope, requirements,
  acceptance criteria, validation, dependencies, and status. New work gets a new ID.
  Completion requires validation, not code changes alone.
- **Consequences:** Slightly more bookkeeping; reliable handover and auditability.
- **Unresolved:** none.

## ADR-015 — Current implementation is migration input, not the target standard

- **Status:** Accepted (2026-11-05)
- **Context:** `docs/BUSINESS-MODULE-GUIDE.md` and existing code describe today's
  patterns, some of which violate the new rules.
- **Decision:** The guide and current code are evidence/migration input. The target is
  this package's rules. Where they differ, the target governs and the migration is
  tracked in the roadmap/progress. Do not copy current violations into new modules.
- **Consequences:** New modules must follow the target rules even before legacy modules
  are migrated; mixed compliance is expected during transition.
- **Unresolved:** none.

## ADR-016 — Facades may invoke services, but not orchestrate repositories/factories

- **Status:** Accepted (2026-11-05)
- **Context:** R-13 says facades may invoke services "following the same orchestration
  principles as use cases." Read broadly, that could let facades access repositories,
  factories, or outbound ports, turning them into a second orchestration layer and
  bypassing R-12/R-15.
- **Decision:** Apply R-13 narrowly: facades primarily invoke own use cases; when
  necessary they may invoke application/domain services. Repository/factory/outbound-port
  orchestration belongs in a use case (or a justified application service).
- **Consequences:** Facades stay thin public-surface adapters; no duplicate orchestration
  path. If a facade genuinely needs broader orchestration, extract it into a use case.
- **Unresolved:** none; this is a documented narrowing, not a rule change.

## ADR-017 — Infrastructure adapters may depend on domain ports/types (implementing side)

- **Status:** Accepted (2026-11-05)
- **Context:** R-16/R-17 permit only domain services, repositories, and factories to be
  accessed outside the domain. Persistence adapters, however, must implement domain
  repository ports and map aggregates/entities/VOs to rows; without the domain contracts
  they cannot fulfill the port. A literal reading would make hexagonal persistence
  impossible.
- **Decision:** `infrastructure/persistence/**` (and other adapters implementing a domain
  port) MAY import the domain repository port and the domain types required to implement
  it. The dependency direction stays inward (infrastructure → domain), which preserves
  dependency inversion. Adapters contain mapping/persistence only, no business logic.
  This exception does not allow `application/**` or `presentation/**` to import domain
  aggregates/entities/VOs/types/events; R-16/R-17 and ADR-005 still govern those.
- **Consequences:** Persistence works without weakening domain isolation. Architecture
  tests must distinguish "infrastructure implements domain port" (allowed) from
  "application/controller imports domain internals" (forbidden).
- **Unresolved:** whether application query repositories need domain types for query
  records; decide during the Phase 1/2 audit without widening the rule silently.

---

## Decision index

| ADR | Topic | Status |
| --- | --- | --- |
| 001 | Documentation-first / no source changes | Accepted |
| 002 | Documentation location and precedence | Accepted |
| 003 | Thin controllers | Accepted |
| 004 | Use-case orchestration-only | Accepted |
| 005 | Strict domain access / type-event ambiguity | Accepted with open question |
| 006 | Invariants/policies own domain errors | Accepted |
| 007 | No unnecessary application DTOs/mappers | Accepted |
| 008 | Inbox-first listeners | Accepted |
| 009 | Cache/idempotency decorators only | Accepted |
| 010 | Middleware/guard/use-case + IAM dependency | Accepted with open question |
| 011 | Application services optional | Accepted |
| 012 | Documentation conflict handling | Accepted |
| 013 | Background context restoration | Accepted |
| 014 | Task granularity/status model | Accepted |
| 015 | Current implementation is migration input | Accepted |
| 016 | Facade service access is narrow | Accepted |
| 017 | Infrastructure adapters may implement domain ports | Accepted |

# Business Module Architecture Rules

> **Status:** normative target standard. Rules use MUST / MUST NOT and may not be
> weakened by an implementation task. Conflicts and ambiguities are recorded in
> [`ARCHITECTURAL-DECISIONS.md`](./ARCHITECTURAL-DECISIONS.md).
> **Applies to:** all modules under `src/business/**`.
> **Source:** Section 2 of the Business Module Architecture Standardization mandate,
> consolidated verbatim in intent and tagged with stable rule IDs. The 2026-11-05
> clarifications add R-44…R-46 without renumbering existing rules.

The rules below are the **business-module** standard. They do not replace the
repo-wide hard rules in `AGENTS.md` and `ARCHITECTURE.md` (tenancy scoping, outbox-only
side effects, ESLint import boundaries, physical SQL column names, schema conventions,
no migrations). Both sets apply; where the business-module rule is stricter, it governs
business modules and the conflict is recorded in an ADR.

---

## 1. Controllers (R-01…R-03)

- **R-01 — Thin controllers.** Controllers MUST remain thin. Their only responsibility
  is to invoke the appropriate use case(s).
- **R-02 — No logic in controllers.** Controllers MUST NOT contain conditional logic,
  business logic, calculations, or additional processing.
- **R-03 — Delegate orchestration.** All application orchestration MUST be delegated
  to use cases.

## 2. Use cases (R-04…R-11)

- **R-04 — Orchestration-only dependencies.** Use cases are responsible only for
  orchestrating: application services, outbound ports, domain repositories, domain
  services, and domain factories.
- **R-05 — No direct business work.** Use cases MUST NOT perform business logic,
  calculations, or domain operations directly. Those responsibilities MUST be
  delegated to the appropriate services.
- **R-06 — Orchestrate, handle errors, return.** Use cases MUST only orchestrate
  operations, invoke the required services, and handle error throwing or response
  returning.
- **R-07 — No facade calls.** A use case MUST NEVER call a facade.
- **R-08 — No unnecessary intermediate variables.** Avoid introducing intermediate
  variables whose only purpose is to forward a value to another function; pass values
  directly where appropriate.
- **R-09 — Cross-file passing allowed.** Passing variables across multiple files is
  acceptable when necessary.
- **R-10 — Date exception.** Date-related variables are an acceptable exception to
  R-08.
- **R-11 — Context sequence.** Every use case MUST follow the request-context
  initialization and authorization sequence defined in
  [`REQUEST-LIFECYCLE.md`](./REQUEST-LIFECYCLE.md) and
  [`AUTHORIZATION.md`](./AUTHORIZATION.md) (retrieve the complete request context,
  configure the base ABAC context, then continue orchestration sequentially).

## 3. Facades (R-12…R-15)

- **R-12 — Primarily invoke use cases.** Facades SHOULD primarily invoke use cases.
- **R-13 — Services allowed when necessary.** Facades MAY invoke services when
  necessary, following the same orchestration principles as use cases (R-04…R-10).
- **R-14 — No facade-to-facade.** One facade MUST NEVER invoke another facade.
- **R-15 — No business-logic layer.** Facades MUST NOT become an additional layer for
  implementing business logic.

## 4. Domain layer and dependency boundaries (R-16…R-23, R-44)

- **R-16 — Domain isolation.** Domain files MUST only be accessed and used within the
  Domain layer.
- **R-17 — Permitted domain access.** Other layers MUST NOT directly depend on Domain
  files, except for these explicitly permitted components, which use cases may access
  where necessary:
  - domain services,
  - domain repositories,
  - domain factories.
- **R-18 — Domain services.** Domain services are responsible for business-related
  computations, calculations, and specialized domain operations. They MUST encapsulate
  domain operations instead of allowing use cases to perform them directly. They MUST
  NOT independently throw invariant or policy violations.
- **R-19 — Invariants.** Invariants are responsible for enforcing domain constraints.
  They MUST protect the validity of domain state and values. They MUST be the
  designated mechanism for enforcing invariant-related violations.
- **R-20 — Policies.** Policies are responsible for enforcing business rules based on
  input values, service return values, or configuration data. They MUST encapsulate
  business-rule decisions instead of distributing them across application components.
- **R-21 — Domain-level errors.** Invariants and policies MUST be the only components
  that throw domain-level errors.
- **R-22 — Services do not throw invariant/policy violations.** Services MUST NOT
  independently throw invariant or policy violations. Invariant/policy violations are
  enforced by invariants/policies, not by services.
- **R-23 — Strict boundaries.** Maintain strict dependency boundaries and ensure that
  domain implementation details are not unnecessarily exposed to other layers.
- **R-44 — Types may cross layers; events may not (clarification 2026-11-05).**
  Non-event type declarations (interfaces, type aliases, plain data shapes) MAY be
  accessed and used across layers where necessary; prefer `import type` so no runtime
  dependency is created. Events MUST NOT be accessed or used across layers where they
  are not explicitly allowed. Domain events remain domain-only. Incoming/outgoing event
  contracts are application-layer plain types and may be used only by their dedicated
  listener/publisher (and the port that carries them). A use case must not import a
  domain event; it invokes a publisher/outbound port instead. The platform's structural
  `OutboxEvent` transport envelope is permitted only at the publisher/outbox-port
  boundary, not as a domain/application event carried through controllers or use cases.

> **R-16/R-17 clarified by R-44 (2026-11-05).** Non-event type declarations MAY be
> accessed and used across layers where necessary (prefer `import type`). Runtime value
> imports of domain aggregates/entities/VOs/invariants/policies remain limited to the
> permitted components (domain services, repositories, factories). Events are **not**
> covered by this type exception: domain events remain domain-only, and application
> event contracts are used only by their listener/publisher and the port that carries
> them. See ADR-005.

## 5. Application-layer DTOs and mappers (R-24…R-25)

- **R-24 — No required application DTOs/mappers.** DTOs and mappers are not required in
  the Application layer. Avoid introducing unnecessary DTOs and mapping abstractions.
- **R-25 — No unnecessary abstractions.** Do not create additional abstractions unless
  they provide a clear architectural or functional benefit.

> Persistence mappers (`infrastructure/persistence/**/*.mapper.ts`) are not
> application-layer DTOs; they remain an infrastructure concern under the repo-wide
> architecture. See [`LAYER-RESPONSIBILITIES.md`](./LAYER-RESPONSIBILITIES.md).

## 6. Event integrations (R-26…R-31, R-45)

- **R-26 — Separate directions.** Event integrations MUST follow a consistent
  separation between incoming and outgoing events.
- **R-27 — Incoming structure.** The Application layer MUST contain event contracts and
  one individual listener file per event.
- **R-28 — Listener sequence.** Every listener MUST follow this execution sequence:
  1. receive the incoming event;
  2. check the Inbox to determine whether the event was already processed;
  3. stop processing if already handled;
  4. if not processed, invoke the corresponding use case.
- **R-29 — Inbox before use case.** The Inbox check MUST always happen before invoking
  the use case.
- **R-30 — Outgoing structure.** Outgoing events MUST maintain appropriate event
  contracts and separate publisher files.
- **R-31 — Publishing separate from business logic.** Publishing responsibilities MUST
  be kept separate from use-case business logic.
- **R-45 — Unavailable modules/integrations are port-only (clarification
  2026-11-05).** When a required module or integration is unavailable, define the
  necessary outbound port and its contract. Business modules MUST depend on and invoke
  that port. Do NOT implement or recreate the unavailable module/integration. The real
  implementation/adapter may be supplied later without changing business-module
  orchestration. Do not create fake behavior that pretends the integration exists.

## 7. Caching and idempotency (R-32…R-35, R-46)

- **R-32 — Decorators only.** Caching and idempotency MUST be implemented through
  decorators.
- **R-33 — No direct ports in use cases.** Use cases MUST NOT directly invoke cache or
  idempotency ports.
- **R-34 — Keep cross-cutting concerns separate.** These cross-cutting concerns MUST
  remain separate from use-case orchestration.
- **R-35 — Audit existing usage.** Existing implementations MUST be audited to identify
  direct cache or idempotency dependencies inside use cases.
- **R-46 — Decorator placement (clarification 2026-11-05).** Cache and idempotency
  decorators MUST be applied only at controller endpoints, never on use-case methods or
  inside use cases. Use cases MUST NOT apply or invoke caching or idempotency decorators
  directly. The only decorator permitted at the use-case level is `@Transactional()`,
  which use cases MAY use to manage transaction boundaries. Caching and idempotency
  remain outside use-case execution and are handled through decorators at controller
  endpoints. Background duplicate suppression uses the Inbox, not these decorators.

## 8. Request context, configuration, and authorization (R-36…R-43)

### 8.1 Middleware responsibilities

- **R-36 — Context initialized by middleware.** The request context MUST be initialized
  and assigned by middleware.
- **R-37 — Middleware scope.** Middleware is responsible for:
  1. establishing the request context;
  2. resolving tenancy information;
  3. resolving authentication information;
  4. fetching company configuration using the request context;
  5. making the complete request context available to subsequent application execution.

### 8.2 Guard responsibilities

- **R-38 — Guards enforce RBAC.** Guards are responsible for enforcing Role-Based
  Access Control (RBAC).
- **R-39 — Authorization stays in guards.** Authorization checks MUST remain within the
  appropriate guard mechanism.

### 8.3 Use-case execution sequence

- **R-40 — Retrieve context first.** At the beginning of every use case, retrieve the
  complete request context.
- **R-41 — Configure base ABAC.** Configure the base Attribute-Based Access Control
  (ABAC) context immediately after retrieving the request context.
- **R-42 — Sequential execution.** Continue with the remaining operations sequentially
  according to the use case's orchestration requirements.
- **R-43 — Context before business.** The complete request context MUST be available
  before executing subsequent business operations.

---

## 9. Inherited non-negotiable repo rules

These come from `AGENTS.md` / `ARCHITECTURE.md` and apply to every business module:

- **INH-01 — Tenancy.** Business tables are tenant-scoped; reads/writes filter by
  `tenantId`/`companyId`; a foreign row is **404**, never 403. Master data additionally
  sees unscoped rows.
- **INH-02 — Company-scoped natural keys.** Document numbers/SKUs/codes are unique
  within a company; numbering series are company-scoped.
- **INH-03 — Outbox only.** Cross-process side effects leave through
  `OutboxWriterPort` inside the caller's transaction; never publish from a use case
  directly.
- **INH-04 — Import boundaries.** Business code imports only platform ports,
  shared-business, shared-kernel types, and another module's `public/**`.
  `@infrastructure/**` and raw clients are forbidden.
- **INH-05 — Domain purity.** `domain/**` imports no `@nestjs/*`, `@platform/**`, or
  `@infrastructure/**`.
- **INH-06 — Schema contract.** `prisma/schema/**` is the table contract; there are no
  migrations. Edit the schema, then `npm run db:push` + `npx prisma generate`.
- **INH-07 — Physical SQL names.** Hand-written SQL must use physical column names
  (`outbox_messages`, `inbox_messages`, `saga_steps` are snake_case; others are
  camelCase).
- **INH-08 — Verification.** `npx tsc --noEmit`, `npm run lint:check`,
  `npm run format:check`, `npm run docs:di` when wiring changes, the DI smoke test, and
  the relevant e2e suites must pass before a task is `COMPLETED`.

---

## 10. Rule compliance and conflict handling

1. A task that finds a rule impossible to satisfy MUST record the conflict and its
   implications in an ADR.
2. A task MUST NOT remove, relax, or silently reinterpret a rule.
3. If a rule is ambiguous in a way that materially affects implementation, record the
   ambiguity in an ADR and mark the affected task `BLOCKED` or `NEEDS_REVIEW` until
   clarified.
4. Rule IDs are stable. New rules get new IDs; superseded rules are marked
   `Superseded by ADR-xxx` rather than deleted.
5. The final compliance report (P10-14) maps every rule to its verification evidence.

---

## 11. Clarification log

| Date | Rule | Clarification | ADR |
| --- | --- | --- | --- |
| 2026-11-05 | R-44 | Types may be accessed across layers where necessary; events remain restricted to explicit contracts/listeners/publishers. | ADR-005 (resolved) |
| 2026-11-05 | R-45 | Unavailable modules/integrations are represented by ports/contracts; do not implement or recreate them. | ADR-018 |
| 2026-11-05 | R-46 | Cache/idempotency decorators only at controller endpoints; use cases only `@Transactional()`. | ADR-009 (clarified) |

Rule IDs are stable: R-44…R-46 were added after Phase 0 without renumbering R-01…R-43.

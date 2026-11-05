# Layer Responsibilities

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md).
> Defines what each component owns, what it may depend on, and what it must never do.
> "MUST" rules are binding; see the rule IDs for traceability.

---

## 1. Component responsibility matrix

| Component | Owns | MAY depend on | MUST NOT |
| --- | --- | --- | --- |
| **Controller** | HTTP binding, route/query/body binding, request DTO validation, endpoint decorators (`@Idempotent`, `@Cacheable`, `@CacheEvict`), invoking use case(s), returning `{ data, message }` | Use cases, request/response DTOs, non-event types (including `import type` domain types where necessary), shared-kernel types/decorators | Business logic, conditionals, calculations, transactions (`@Transactional` belongs to the use case), repositories, domain runtime classes/events, platform ports, facades |
| **Use case** | Entry-point orchestration for one operation; retrieves complete request context; configures base ABAC; invokes application services/outbound ports/domain repositories/domain services/domain factories; error throwing/response returning; may use `@Transactional()` only | Application services, outbound ports, domain repositories, domain services, domain factories, non-event types, platform **ports** (via module-local ports), shared-kernel types, `@Transactional()` | Business logic, calculations, direct domain operations, calling a facade, direct cache/idempotency ports or decorators, any decorator other than `@Transactional()`, direct broker/outbox publishing, importing domain events, raw infrastructure |
| **Application service** | Reusable stateless application-layer operation or multi-step domain workflow (optional; only when reuse/benefit is real) | Domain repositories, domain services, domain factories, outbound ports, non-event types, shared-kernel types | HTTP concerns, facade calls, invariant/policy throwing, becoming a parallel business-rule layer, cache/idempotency decorators or ports, direct raw clients |
| **Facade** | Implements this module's `public/` port for another module; delegates to own use cases (and services when necessary) | Own use cases, application services, domain services when necessary, non-event public-contract types | Calling another facade, business logic, domain internals beyond permitted services, event classes/contracts outside its public surface, repositories/factories/outbound ports directly, HTTP concerns |
| **Domain service** | Business-related computations, calculations, specialized domain operations; encapsulates reusable domain operations | Domain types, value objects, entities, other domain services, shared-business primitives | Throwing invariant/policy violations, NestJS/platform/infrastructure dependencies, persistence, HTTP, orchestration of use cases |
| **Domain repository (port)** | Persistence contract for the aggregate, expressed in domain types; abstract class = DI token | Domain types only | Framework imports, concrete persistence details, business decisions |
| **Domain factory** | Sole sanctioned construction/reconstitution path; enforces creation invariants; raises creation events | Domain aggregate/entities/VOs, invariants, policies, domain events, shared-business | Persistence, HTTP, platform/infrastructure, business-rule orchestration outside construction |
| **Invariant** | Enforces domain constraints over own state/values; throws domain-level errors | Plain state/typed inputs | Business-rule decisions based on external/config data (that is a policy), persistence, framework |
| **Policy** | Enforces business rules from inputs, service return values, or configuration; throws domain-level errors | Plain inputs/service results/config-shaped data, shared-business | Persistence, framework, HTTP, orchestrating use cases |
| **Aggregate / Entity / Value Object** | State, behavior, invariants/policies, domain events | Shared-business, own domain types | Framework/platform/infrastructure, persistence, HTTP, cross-aggregate imports |
| **Incoming event listener** | Receive event, check Inbox, stop on duplicate, invoke use case | Its incoming event contract (explicitly allowed), InboxPort, use cases, decorators for transport | Business logic, direct repository/domain access, domain events/classes, invoking a use case before the Inbox check, raw clients |
| **Incoming event contract** | Plain JSON-safe shape of the received event | Plain types | Domain classes, framework types, behavior |
| **Outgoing event contract** | Plain JSON-safe wire shape of the published event | Plain types | Domain classes, framework types, behavior |
| **Outgoing publisher** | Build/publish the outgoing event through the integration/outbox port; one publisher per event | Its outgoing event contract (explicitly allowed), integration/outbox port, request context port, non-event types | Business rules/calculations, repository writes, domain events/classes, direct broker clients, being embedded as an anonymous block inside a use case |
| **Unavailable integration port** | Abstract outbound port + plain contract for a capability whose module/integration is unavailable; business modules depend on it and invoke it | Plain contract types, non-event types, shared-kernel types | A fake/recreated unavailable implementation, business logic, raw clients, importing the unavailable module |
| **Persistence mapper** | Translate domain ↔ persistence row / query record | Domain types, generated Prisma row types | Application/HTTP concerns, business decisions, being moved into `application/` without justification |
| **Persistence adapter** | Implements domain repository ports; maps domain ↔ rows; participates in the caller transaction | Domain repository ports/types (ADR-017), generated Prisma client by relative path, mappers, `TransactionHost`/`PrismaReadPort` | Business rules, application/HTTP concerns, raw clients outside the allowed infrastructure boundary |
| **Middleware** | Establish and assign the complete request context: context, tenancy, authentication, company configuration; make it available downstream | Shared-kernel/platform context ports, auth/tenancy/config resolvers, platform ports | Business logic, RBAC decisions (guard responsibility), invoking use cases |
| **Guard** | RBAC enforcement | Request context, auth/role data, metadata decorators | Business logic, tenancy resolution, company configuration fetching, invoking use cases |
| **Platform adapter** | Implement a module-local outbound port by delegating to a platform port | Platform ports, module-local port contracts | Business rules, importing `@infrastructure` raw clients, importing platform concrete services directly |
| **Composition root** | Wire modules/providers; bridge business opt-in handlers into platform registries | Modules, providers, platform registries, business handlers | Business logic, runtime business decisions |

> **Application services are optional by design.** In the current repo, most
> application behavior lives in use cases and domain services; there is no
> `application/services/` folder. Introduce an application service only when it removes
> real duplicated orchestration or isolates a genuine domain workflow (R-25). Do not
> create one merely to rename an existing use case.

> **Type vs. event access (R-44).** Non-event type declarations may be imported across
> layers where necessary; prefer `import type` so no runtime dependency is created.
> Runtime value imports of domain aggregates/entities/VOs remain limited to the
> permitted components. Events are not covered by this exception: domain events stay in
> the domain; incoming/outgoing event contracts are used only by their dedicated
> listener/publisher and the port that carries them. The platform structural
> `OutboxEvent` envelope is permitted only at the publisher/outbox-port boundary.

> **Unavailable integrations (R-45).** Define the outbound port and contract, inject and
> invoke the port from the business module, and leave the adapter/implementation for
> later. Do not create a fake implementation or recreate the unavailable module.

> **Decorator placement (R-46).** Cache/idempotency decorators belong only on controller
> endpoints. A use case may use only `@Transactional()`; it must not use cache or
> idempotency decorators or ports.

---

## 2. Permitted interactions

| From → To | Allowed? | Condition |
| --- | --- | --- |
| Controller → use case | Yes | One operation per call; no extra logic. |
| Controller → request/response DTO | Yes | Zod DTOs / response shapes. |
| Controller → non-event types | Yes | Type-only imports where necessary; no runtime domain classes/events. |
| Controller → `@Idempotent`/`@Cacheable`/`@CacheEvict` | Yes | Endpoint decorators only; guards run before them. |
| Controller → `@Transactional` | No | Transaction boundary belongs to the use case. |
| Controller → application service | No | Controllers go through use cases. |
| Controller → facade/repository/domain/platform port | No | Violates R-01/R-02/R-16. |
| Use case → application service | Yes | When the service exists for real reuse/domain workflow. |
| Use case → outbound port | Yes | Cross-module/platform capability. |
| Use case → domain repository | Yes | Permitted by R-17. |
| Use case → domain factory | Yes | Permitted by R-17. |
| Use case → domain service | Yes | Permitted by R-17. |
| Use case → non-event types | Yes | Type-only imports where necessary. |
| Use case → `@Transactional()` | Yes | The only decorator permitted at use-case level (R-46). |
| Use case → cache/idempotency decorator | **No** | R-46; decorators belong at controller endpoints. |
| Use case → domain/integration event class | **No** | Events are restricted (R-44); use a publisher/outbound port. |
| Use case → facade | **No** | R-07. |
| Use case → another use case | No | Extract shared orchestration to an application service (R-25). |
| Use case → cache/idempotency port | **No** | R-33/R-46; cache/idempotency decorators belong at controller endpoints. |
| Use case → raw broker/outbox client | No | Use the integration/outbox port (INH-03). |
| Facade → use case | Yes | Primary responsibility. |
| Facade → application service | Yes | When necessary (R-13). |
| Facade → domain service | Yes | When necessary and following the same orchestration principles (R-13/R-17). |
| Facade → facade | **No** | R-14. |
| Facade → repository/factory/outbound port/platform port | No | Keep facades as thin public-surface delegation; use a use case/service. |
| Domain service → domain types/VOs/entities | Yes | Within the domain. |
| Domain service → repository/persistence/platform/infrastructure | No | Domain purity. |
| Domain service → invariant/policy | Yes (read-only) | May read/consult them, but MUST NOT throw invariant/policy violations itself (R-18/R-22). |
| Repository port → domain types | Yes | Contract speaks domain types. |
| Factory → invariants/policies/aggregate/events | Yes | Sole creation path. |
| Invariant/policy → domain error | Yes | Only components allowed to throw domain-level errors (R-21). |
| Listener → incoming event contract | Yes | The only event type a listener may read (R-44). |
| Listener → InboxPort | Yes | Mandatory before use case. |
| Listener → use case | Yes | Only after duplicate check. |
| Listener → repository/domain | No | Must delegate to a use case. |
| Publisher → outgoing event contract | Yes | The only event type a publisher may build (R-44). |
| Publisher → integration/outbox port | Yes | Publishing only. |
| Publisher → use case/repository | No | Publishing is not a business operation. |
| Publisher → domain event | No | Domain events stay in the domain; map to the outgoing contract. |
| Middleware → context/auth/tenancy/config resolvers | Yes | Establishes the complete context. |
| Guard → request context/RBAC data | Yes | RBAC only. |
| Guard → company config/use case | No | Not guard responsibilities. |
| Infrastructure adapter → platform port | Yes | Ports & adapters. |
| Unavailable port → implementation | No | Deferred; do not fake or recreate (R-45). |
| Domain → any outer layer | No | Dependency inversion: inner layers know nothing outer. |

> **R-13 interpretation.** Facades primarily invoke use cases. When necessary they may
> invoke application/domain **services**, but repository/factory/outbound-port
> orchestration stays in a use case; this prevents a facade from becoming a second
> orchestration/business-logic layer. See ADR-016.

---

## 3. Forbidden interactions (summary)

1. Controller → repository, domain, facade, platform port, or any business conditional.
2. Use case → facade; use case → another use case; use case → cache/idempotency port.
3. Facade → facade; facade → repository/factory/outbound port/platform port; facade → domain internals beyond permitted domain services.
4. Listener → repository/domain; listener → use case before Inbox check.
5. Publisher → repository/use case; publisher embedded as business logic.
6. Domain → NestJS, platform, infrastructure, HTTP, persistence, or another aggregate.
7. Service (application/domain) → invariant/policy violation throwing.
8. Middleware → RBAC/business use case; guard → tenancy/company-config/use case.
9. Any business file → `@infrastructure/**`, raw Prisma/broker/Redis clients, or another
   module's internals.
10. Event classes/contracts used outside their explicit listener/publisher/port.
11. Cache/idempotency decorators on use-case methods; any use-case decorator other than
    `@Transactional()`.
12. Implementing or recreating an unavailable module/integration instead of defining a
    port and contract.

---

## 4. Current repo mapping and gaps

| Component | Current location | Gap vs target |
| --- | --- | --- |
| Controllers | `presentation/http/*.controller.ts` | Mostly thin; some endpoints perform existence checks/`NotFoundException` (e.g. product `GET /:id`). Phase 1 must classify transport mapping vs. business logic; Phase 3 removes business logic from controllers. |
| Use cases | `application/usecases/*.usecase.ts` | Often perform factory→save→pullEvents, direct aggregate operations, calculations, and direct cache-port reads. R-05/R-08/R-11/R-33/R-46 migration required; only `@Transactional()` may remain. |
| Application services | Not present | Optional; introduce only where reuse/benefit is proven (R-25). |
| Facades | `application/facades/*.facade.ts` | Audit for facade→facade and business logic. |
| Domain services | `domain/services/*.ts` | Real calculations live here in product/purchase-order; audit for invariant/policy throwing and framework imports. |
| Invariants/policies | `domain/**/*.invariants.ts`, `domain/policies/*.ts` | Registered via shared registries; audit coverage/error semantics. |
| Event listeners | `application/integrations/listens/**` | Most only log; no Inbox check. Major Phase 6 gap. Event contracts are the only event types listeners may use. |
| Event publishers | `application/integrations/publishes/**` | Publisher ports + `OutboxAdapter` exist; audit one-file-per-event and use-case coupling. |
| Middleware | No business-module middleware; `RequestIdInterceptor` seeds CLS | Target requires middleware to initialize context and fetch company config. Phase 5 gap. |
| Guards | `TenancyAuthGuard` (tenancy/authentication) | No RBAC guard; no ABAC context. IAM deferred. Phase 5 gap/blocker risk. |
| Cache/idempotency | `@Idempotent()` exists; PO injects `ReadCachePort` | Direct cache port usage violates R-33; cache decorators do not exist yet; decorators must move to controller endpoints and use cases keep only `@Transactional()` (R-46). Phase 7 gap. |

> This table is deliberately high-level. The authoritative, file-referenced audit is
> produced in Phase 1 (`P1-17`) and stored in `PROGRESS.md` plus follow-up tasks.
>
> **Unavailable integrations:** the current repo contains scaffold/empty platform
> modules; these must be treated as unavailable capabilities. Business modules should
> depend on ports/contracts, not on the missing implementation (R-45; ADR-018).

# Dependency Boundaries

> Normative companion to [`ARCHITECTURE-RULES.md`](./ARCHITECTURE-RULES.md) (R-16…R-25).
> Defines allowed dependency directions, prohibited cross-layer dependencies, domain
> access rules, dependency inversion, and examples.
> Repo-wide ESLint boundaries remain in force (`eslint.config.mjs`, `AGENTS.md`).

---

## 1. Allowed dependency direction

```text
┌────────────────────────────────────────────────────────────────────┐
│ presentation/http  (controllers, request/response DTOs)            │
│        │ calls use cases directly                                  │
│        ▼                                                           │
│ application  (use cases, facades, outbound ports,                 │
│               integrations/listens, integrations/publishes,        │
│               optional application services)                       │
│        │ may call: application services, outbound ports,            │
│        │ domain repositories, domain services, domain factories     │
│        ▼                                                           │
│ domain  (aggregates, entities, VOs, events, invariants, policies,  │
│          factories, domain services, repository ports)             │
│        │ depends only on                                         │
│        ▼                                                           │
│ shared-business  (framework-free primitives)                       │
└────────────────────────────────────────────────────────────────────┘

infrastructure (persistence/adapters) ──implements──▶ domain/application ports
infrastructure ──delegates to──▶ platform ports
composition root/business module ──binds──▶ ports to adapters
```

Dependency inversion: the domain/application layers own the contracts (abstract
classes); infrastructure and platform adapters implement them. Inner layers MUST NOT
import outer layers.

---

## 2. Allowed dependencies by layer

| Layer | MAY import | Notes |
| --- | --- | --- |
| `presentation/http` | own application use cases, request/response DTOs, non-event types (including `import type` domain types where necessary), shared-kernel types/decorators | Controllers call use cases directly; no inbound-port/mediator layer. No runtime domain classes/events. |
| `application/usecases` | application services, outbound ports, domain services, domain repositories, domain factories, non-event types (including `import type` domain types), platform **ports** (through module-local ports), shared-kernel types, `@Transactional()` | R-04/R-44/R-46; no facade calls; no direct cache/idempotency ports or decorators; only `@Transactional()` at use-case level; no domain events. |
| `application/facades` | own use cases, own application services, domain services when necessary, non-event public-contract types | R-12/R-13/R-44; no facade→facade; no repository/factory/outbound-port access; no event classes outside its public surface. |
| `application/queries` | shared-kernel pagination/types, application query-record types | Query ports return plain records, not aggregates. |
| `application/integrations/listens` | its incoming event contracts (explicitly allowed), InboxPort, use cases, transport decorators | R-44: the only place an incoming event contract may be consumed; no domain events. |
| `application/integrations/publishes` | integration/outbox port, its outgoing event contracts (explicitly allowed), non-event types | R-44/R-45: one publisher per event; no business logic; no domain events. |
| `domain/**` | own domain files, shared-business primitives | No NestJS, platform, infrastructure, HTTP, persistence. |
| `infrastructure/persistence` | domain ports/types, generated Prisma client by **relative path**, mappers, platform `PrismaReadPort` / `TransactionHost` | Command repos use `TransactionHost`; query repos use `PrismaReadPort`. |
| `infrastructure/adapters/platform` | module-local outbound ports, platform ports | Delegate; never import platform concrete services or `@infrastructure` raw clients. |
| `infrastructure/adapters/business-aggregate` | consumer outbound port, producer `public/` contract/port | Cross-module reads only through the producer's exported token. |
| `public/**` | shared-business/simple primitives, plain contracts, non-event types | The only cross-module surface; no domain classes, events, or internals. |
| `bootstrap/**` | business handlers, platform registries | Composition-root bridge only; the only layer allowed to know both sides. |

---

## 3. Prohibited dependencies

### 3.1 Cross-layer

- `presentation` → domain runtime classes/events, `infrastructure/**`, platform concrete services, repositories. Type-only imports of non-event domain types are allowed (R-44).
- `application` → `presentation/**`, `infrastructure/**` (except through ports), platform concrete services, domain runtime classes/events. Type-only imports of non-event domain types are allowed (R-44).
- `domain` → `application/**`, `presentation/**`, `infrastructure/**`, `@platform/**`, `@nestjs/*`.
- `shared-business` → `@platform/**`, `@infrastructure/**`, any concrete business module.
- `platform` → any `@business/**` (single ESLint regex; composition root is the bridge).
- Any business file → raw clients (`@prisma/client` bare specifier, `amqplib`, `kafkajs`,
  `ioredis`, `redis`, `@golevelup/nestjs-rabbitmq`, `@ssut/nestjs-sqs`,
  `@nestjs/schedule` outside platform).

### 3.2 Domain-file access (R-16/R-17, clarified by R-44)

Only these domain **runtime components** may be accessed from outside the domain layer:

1. domain services,
2. domain repositories,
3. domain factories.

**Type-only access is allowed (R-44, 2026-11-05).** Non-event type declarations
(interfaces, type aliases, plain data shapes — including domain `types/`) MAY be
imported across layers where necessary; prefer `import type` so the import is erased and
creates no runtime dependency. This does not permit runtime value imports of aggregates,
entities, value objects, invariants, policies, or factories outside the permitted
components.

**Events are not covered by the type exception.** Domain events remain domain-only.
Application event contracts are plain types in `application/integrations/**` and may be
used only by their dedicated listener/publisher and the port that carries them. A use
case MUST NOT import a domain event; it invokes a publisher/outbound port. In particular:

- A use case MAY import non-event domain types (prefer `import type`) but MUST NOT import
  aggregates/entities/VOs/invariants/policies/events as runtime values.
- A controller MAY import non-event types but MUST NOT import domain runtime classes or
  events.
- A facade MAY import non-event types but MUST NOT import domain runtime classes/events;
  it delegates behavior to use cases/services.
- A listener MAY import only its incoming event contract; a publisher MAY import only its
  outgoing event contract. Neither may import domain events/classes.
- The platform structural `OutboxEvent` envelope is permitted only at the
  publisher/outbox-port boundary; it is not a domain/application event.
- **Adapter exception (ADR-017):** infrastructure adapters that implement a domain port
  MAY import that port and the domain types required to implement it (the dependency
  points inward). This does not permit application/presentation/listener/publisher
  imports of domain runtime internals.

> **Resolved by ADR-005 (2026-11-05).** Types may cross layers where necessary; events
> remain explicitly restricted. Use `import type` for domain type dependencies and keep
> event handling at the listener/publisher/port boundary.

### 3.3 Use case and facade restrictions

- Use case → facade: **forbidden** (R-07).
- Use case → use case: **forbidden**; extract shared orchestration to an application
  service only when justified (R-25).
- Facade → facade: **forbidden** (R-14).
- Facade → repository/factory/outbound port/platform port directly: **forbidden**;
  delegate to a use case. A facade MAY invoke an application/domain service when
  necessary (R-13), but must not become a business-logic layer.
- Facade → domain internals beyond permitted domain services: **forbidden**.
- Use case → direct cache/idempotency port: **forbidden** (R-33); use controller-endpoint decorators.
- Use case → cache/idempotency decorator: **forbidden** (R-46); only `@Transactional()` is permitted at use-case level.
- Controller endpoint → cache/idempotency decorator: **allowed** (R-46); guards run before the endpoint.
- Use case/facade/listener/publisher → domain event: **forbidden** (R-44); use the explicit event contract/port.
- Recreating or faking an unavailable module/integration: **forbidden** (R-45); define a port and contract.

### 3.4 Cross-module

- Business module → another module's `domain/**`, `application/queries/**`,
  `application/usecases/**`, `application/integrations/**`, `application/facades/**`,
  `infrastructure/**`: **forbidden**; use its `public/**` contract + local outbound
  port.
- Consumer adapter must live in the consumer module and implement a consumer-owned
  outbound port; the producer never binds consumer ports.
- Nest `imports` are only to make exported providers resolvable; they do not permit
  importing internals.

---

## 4. Acceptable examples

### 4.1 Controller → use case only

```ts
// presentation/http/product.controller.ts
@Post()
async create(@Body() dto: CreateProductDto): Promise<ApiResponse<IdResponse>> {
  const id = await this.createProductUseCase.execute({ ...dto });
  return { data: { id }, message: 'Product created' };
}
```

### 4.2 Use case → permitted domain components + outbound port

```ts
// application/usecases/create-product.usecase.ts
constructor(
  private readonly products: ProductCommandRepository, // domain repository (permitted)
  private readonly pricing: ProductPricingService,      // domain service (permitted)
  private readonly factory: typeof ProductFactory,      // domain factory (permitted)
  private readonly companyConfig: CompanyConfigPort,    // outbound port (permitted)
) {}

// Type-only domain imports are allowed where necessary (R-44):
import type { ProductPricingInput } from '../../domain/types/...';
```

### 4.3 Facade → own use case

```ts
// application/facades/product-for-purchase.facade.ts
async getPurchasableProduct(id: string) {
  return this.getPurchasableProductUseCase.execute(id);
}
```

### 4.4 Consumer adapter → producer public port

```ts
// infrastructure/adapters/business-aggregate/purchasable-product.adapter.ts
constructor(private readonly productForPurchase: ProductForPurchasePort) {}
getPurchasableProduct(id: string) { return this.productForPurchase.getPurchasableProduct(id); }
```

### 4.5 Listener → Inbox → use case

```ts
// application/integrations/listens/order.approved.listener.ts
async onOrderApproved(envelope: OrderApprovedContract) {
  const delivery = await this.inbox.receive({
    tenantId: envelope.tenantId,
    companyId: envelope.companyId,
    consumer: 'order-approved',
    messageId: envelope.eventId,
    messageType: envelope.eventType,
    payload: envelope.payload,
  });
  if (delivery.status !== 'ACQUIRED') return; // duplicate/busy
  await this.approveOrderUseCase.execute(envelope.aggregateId);
}
```

---

## 5. Unacceptable examples

```ts
// ❌ Controller imports a repository/domain and makes a decision.
@Get(':id')
async get(@Param('id') id: string) {
  const row = await this.productRepository.findById(id);
  if (row.status === 'DISCONTINUED') throw new ConflictException();
  return row;
}

// ❌ Use case calls a facade.
await this.productFacade.getPurchasableProduct(id);

// ❌ Facade calls another facade.
await this.vendorFacade.getOrderableVendor(id);

// ❌ Use case imports the aggregate and mutates it directly.
const po = await this.repo.findById(id);
po.approve();                       // domain operation must be delegated to a service
await this.repo.save(po);

// ❌ Listener invokes the use case before the Inbox check.
await this.useCase.execute(envelope.aggregateId);
await this.inbox.receive(...);

// ❌ Use case injects the cache/idempotency port.
constructor(private readonly cache: CachePort, private readonly idempotency: IdempotencyPort) {}

// ❌ Use case uses a cache/idempotency decorator; only @Transactional is allowed there.
@Cacheable({ key: 'po' })
@Idempotent()
async execute(id: string) { ... }

// ❌ Use case imports a domain event.
import { PurchaseOrderApprovedEvent } from '../../domain/events/...';

// ❌ Recreating an unavailable integration instead of defining a port/contract.
class FakeTaxIntegration { /* pretend implementation */ }

// ❌ Domain imports NestJS/platform/infrastructure.
import { Injectable } from '@nestjs/common';
import { OutboxWriterPort } from '@platform/...';

// ❌ Business module imports another module's internals.
import { PrismaVendorCommandRepository } from '@business/party/vendor/infrastructure/...';
```

---

## 6. Dependency inversion expectations

- Ports are **abstract classes** used as their own DI tokens; implementations are bound
  in the module (`useExisting` preferred when the class is also a provider).
- Use cases depend on the abstraction, never on a concrete adapter.
- Platform adapters implement module-local outbound ports by delegating to platform
  ports; business code never imports platform concrete services.
- Cross-module contracts are plain data shapes + abstract ports in the producer's
  `public/`; consumers own their outbound port and adapter.
- Composition choices belong in `<module>.module.ts` or `src/bootstrap/configure-*.ts`;
  business logic must not know how it is wired.

---

## 7. Enforcement status and gaps

Already enforced by `eslint.config.mjs`:

- platform → no `@business/**`;
- business → no `@infrastructure/**`;
- business module → no another module's internals;
- domain → no `@nestjs/*` and no raw clients;
- raw clients → infrastructure/config/bootstrap/platform only;
- bare `@prisma/client` → nowhere (use the generated client by relative path).

**Not yet enforced** (requires Phase 9 architecture tests or new lint rules):

- controller contains business logic/conditionals;
- use case → facade;
- facade → facade;
- use case → aggregate/entity/VO runtime imports and domain event imports; type-only non-event imports are allowed (R-44);
- listener → use case before Inbox;
- use case → cache/idempotency port or decorator; only `@Transactional()` allowed at use-case level;
- event classes used outside explicit listener/publisher/port contracts;
- type-only imports vs. runtime domain value imports (R-44 distinction);
- recreation/faking of unavailable modules instead of port/contract (R-45);
- middleware vs guard responsibility boundaries;
- use case context/ABAC sequence.

Until Phase 9, these are review-enforced and must be checked manually in every task's
validation. Do not assume `lint:check` proves compliance with R-04…R-15, R-28/R-29,
R-33, R-36…R-46, or the type/event, unavailable-port, and decorator-placement
clarifications.

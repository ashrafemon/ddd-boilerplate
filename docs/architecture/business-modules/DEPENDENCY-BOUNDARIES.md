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
| `presentation/http` | own application use cases, request/response DTOs, shared-kernel types/decorators | Controllers call use cases directly; no inbound-port/mediator layer. |
| `application/usecases` | application services, outbound ports, domain services, domain repositories, domain factories, platform **ports** (through module-local ports), shared-kernel types | R-04; no facade calls; no direct cache/idempotency ports. |
| `application/facades` | own use cases, own application services, domain services when necessary | R-12/R-13; no facade→facade; no repository/factory/outbound-port access. |
| `application/queries` | shared-kernel pagination/types, application query-record types | Query ports return plain records, not aggregates. |
| `application/integrations/listens` | event contracts, InboxPort, use cases, transport decorators | Only place broker subscribe decorators are allowed. |
| `application/integrations/publishes` | integration/outbox port, event contracts | One publisher per event; no business logic. |
| `domain/**` | own domain files, shared-business primitives | No NestJS, platform, infrastructure, HTTP, persistence. |
| `infrastructure/persistence` | domain ports/types, generated Prisma client by **relative path**, mappers, platform `PrismaReadPort` / `TransactionHost` | Command repos use `TransactionHost`; query repos use `PrismaReadPort`. |
| `infrastructure/adapters/platform` | module-local outbound ports, platform ports | Delegate; never import platform concrete services or `@infrastructure` raw clients. |
| `infrastructure/adapters/business-aggregate` | consumer outbound port, producer `public/` contract/port | Cross-module reads only through the producer's exported token. |
| `public/**` | shared-business/simple primitives, plain contracts | The only cross-module surface; no domain classes or internals. |
| `bootstrap/**` | business handlers, platform registries | Composition-root bridge only; the only layer allowed to know both sides. |

---

## 3. Prohibited dependencies

### 3.1 Cross-layer

- `presentation` → `domain/**`, `infrastructure/**`, platform concrete services, repositories.
- `application` → `presentation/**`, `infrastructure/**` (except through ports), platform concrete services.
- `domain` → `application/**`, `presentation/**`, `infrastructure/**`, `@platform/**`, `@nestjs/*`.
- `shared-business` → `@platform/**`, `@infrastructure/**`, any concrete business module.
- `platform` → any `@business/**` (single ESLint regex; composition root is the bridge).
- Any business file → raw clients (`@prisma/client` bare specifier, `amqplib`, `kafkajs`,
  `ioredis`, `redis`, `@golevelup/nestjs-rabbitmq`, `@ssut/nestjs-sqs`,
  `@nestjs/schedule` outside platform).

### 3.2 Domain-file access (R-16/R-17)

Only these domain components may be accessed from outside the domain layer:

1. domain services,
2. domain repositories,
3. domain factories.

Everything else — aggregates, entities, value objects, invariants, policies, domain
`types/`, domain `events/` — is domain-internal. In particular:

- A use case MUST NOT import an aggregate/entity/VO/invariant/policy/event/type file
  directly.
- A controller MUST NOT import any domain file.
- A facade MUST NOT import any domain file except the permitted three.
- A listener/publisher MUST NOT import domain files.
- **Adapter exception (ADR-017):** infrastructure adapters that implement a domain port
  MAY import that port and the domain types required to implement it (the dependency
  points inward). This does not permit application/presentation/listener/publisher
  imports of domain internals.

> **Open interpretation (ADR-005).** The rule is literal and strict. In practice, use
> cases currently import domain input/request types and events. Until the ambiguity is
> resolved, treat those imports as migration debt, not as permitted. Define
> application-layer contracts where a type is needed; the event publisher port types
> against a structural event contract, not a domain event class.

### 3.3 Use case and facade restrictions

- Use case → facade: **forbidden** (R-07).
- Use case → use case: **forbidden**; extract shared orchestration to an application
  service only when justified (R-25).
- Facade → facade: **forbidden** (R-14).
- Facade → repository/factory/outbound port/platform port directly: **forbidden**;
  delegate to a use case. A facade MAY invoke an application/domain service when
  necessary (R-13), but must not become a business-logic layer.
- Facade → domain internals beyond permitted domain services: **forbidden**.
- Use case → direct cache/idempotency port: **forbidden** (R-33); use decorators.

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
- use case → aggregate/entity/VO/type/event imports;
- listener → use case before Inbox;
- use case → cache/idempotency port;
- middleware vs guard responsibility boundaries;
- use case context/ABAC sequence.

Until Phase 9, these are review-enforced and must be checked manually in every task's
validation. Do not assume `lint:check` proves compliance with R-04…R-15, R-28/R-29,
R-33, or R-36…R-43.

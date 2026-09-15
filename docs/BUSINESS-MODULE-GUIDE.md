# Business Module Guide — building a new aggregate under `src/business/<ctx>/<name>` strictly to spec

Companion to `ARCHITECTURE.md` §3 (anatomy), §5 (ports), §15 (checklist). The
reference implementation for EVERY pattern below is the existing
`procurement/product` (simplest full module), cross-module flows from
`procurement/purchase-order`. Copy it; do not invent new shapes.

Ownership rule: if behavior needs aggregate invariants (rules that the entity
alone enforces over its own state), it belongs here, in the aggregate. Platform
services must stay domain-ignorant (`docs/PLATFORM-SERVICE-GUIDE.md`).

---

## 1. Naming map (complete file set of a module)

```
src/business/<ctx>/<name>/
├── <name>.module.ts                    bindings/exports only (no logic)
├── domain/                             ⚠ ZERO @nestjs/* imports allowed (ESLint)
│   ├── aggregates/
│   │   ├── <name>.aggregate.ts         class extends AggregateRoot<<Name>Id>
│   │   └── <name>.invariants.ts        invariantRegistry.register('<name>.create'…)  (side-effect)
│   ├── value-objects/
│   │   ├── <name>.vo.ts  + <name>.invariants.ts      e.g. sku.vo.ts + sku.invariants.ts
│   │   └── <name>-id.vo.ts             extends EntityId-style base, generate()/fromString()
│   ├── events/
│   │   ├── <name>.<past-verb>.event.ts  extends DomainEvent (typed readonly props)
│   │   └── <name>.registry.ts           domainEventRegistry.register per event (payload cast)
│   ├── policies/<name>.policy.ts        policyRegistry.register — reads external data, NOT own state
│   ├── factories/<name>.factory.ts      SOLE construction path: enforce invariants (import side-effect
│   │                                    files here!) → new …/instantiate → super-constructor props
│   ├── types/<name>.types.ts            Props + CreateInput + <Name>QueryRecord, pure types
│   ├── types/<name>.enum.ts             string enums (status…)
│   └── repositories/<name>-command.repository.ts   ABSTRACT CLASS port, domain types only
├── application/
│   ├── usecases/<verb>-<name>.usecase.ts           ONE class per file (`CreateProductUseCase`)
│   ├── queries/<name>.query.ts                     ABSTRACT query port (returns QueryRecord[])
│   ├── outbound-ports/company-config.port.ts       module-local port wrapping @platform port
│   │        ├── numbering.port.ts, <other>-query.port.ts …
│   ├── integrations/publishes/
│   │   ├── <name>.integration-port.ts              abstract: send(event, id)
│   │   └── <name>.<past>.integration-event.ts      plain data shapes for brokers (JSON-safe)
│   ├── integrations/listeners/                     ONLY place @RabbitSubscribe/@KafkaEvent/@SqsMessageHandler allowed
│   │   ├── <name>.created.rabbitmq.listener-event.ts  (+ .kafka. / .sqs. / .event-emitter.)
│   └── facades/<name>-for-<consumer>.facade.ts     implements the public port, delegates to query use cases
├── public/                                           THE only cross-module surface
│   ├── contracts/<name>-for-<consumer>.contract.ts   plain interfaces (no domain classes!)
│   ├── ports/<name>-for-<consumer>.port.ts           abstract class port
│   └── index.ts                                      `export * from './contracts/…'; export * from './ports/…';`
├── infrastructure/
│   ├── persistence/
│   │   ├── prisma-<name>-command.repository.ts       extends the domain port; TransactionHost only
│   │   ├── prisma-<name>-query.repository.ts         implements query port; injects PrismaReadPort (replica!)
│   │   └── prisma-<name>.mapper.ts                   toDomain(row) via <Name>.instantiate, toRow(agg)
│   ├── adapters/platform/
│   │   ├── outbox.adapter.ts                         implements the integration port → OutboxWriterPort.append
│   │   ├── company-config.adapter.ts                 implements local port → @platform CompanyConfigPort
│   │   └── numbering.adapter.ts                      (if the module issues document numbers)
│   └── adapters/module/                              only when THIS module consumes another's public port
│       └── <other>-<name>.adapter.ts                 implements local outbound port via the producer's public/
└── presentation/http/
    ├── <name>.controller.ts                          thin; DeviceResponse for web/mobile read variants
    ├── requests/<verb>-<name>.request.dto.ts         ONE DTO per file (createZodDto + exported schema)
    └── responses/<name>.<web|mobile>.response.dto.ts + id.response.dto.ts
```

## 2. Build order

```bash
# 1) schema FIRST (table contract before code): prisma/schema/<ctx>/<name>.prisma
#    + hand-written migration prisma/migrations/<ts>_<name>/migration.sql
npx prisma generate
# 2) domain leaf-to-root: types → enums → VOs (+id) → invariants → events(+registry)
#    → policies → aggregate → factory
# 3) domain ports: command repository (abstract) ; application query port
# 4) use cases (command: factory → save → pullEvents → integration port ; query use cases)
# 5) infrastructure: mapper, command repo, query repo ; platform adapters (+module-local ports)
# 6) public/ contract+port+index (IF other modules read you) + facade
# 7) presentation: requests DTO, responses DTO(s), controller
# 8) listeners (only if consuming broker events) — application/integrations/listeners/*
# 9) <name>.module.ts: providers, { provide: Port, useExisting: Impl } bindings, export public port
# 10) add "<ctx>/<name>" to businessModules in eslint.config.mjs
# 11) wire into src/business/<ctx>/<ctx>.module.ts (or create the context module) ; BusinessModule already composes contexts
# 12) domain/factories side-effect-import ALL <x>.invariants.ts/policy files (registry enforcement)
# 13) aggregate spec + usecases spec; npm run docs:di
```

## 3. Code templates (verbatim shapes, from product/purchase-order)

**Value object:**
```ts
export class Sku extends ValueObject<{ value: string }> {
  private constructor(value: string) { super({ value }); }
  static create(input: string): Sku { return new Sku(input.trim().toUpperCase()); }
  get value(): string { return this.props.value; }
}
```

**Invariant (side-effect file, keyed in the shared registry):**
```ts
invariantRegistry.register('sku.create', (data: Record<string, unknown>) => {
  if (typeof data.sku !== 'string' || !data.sku) throw new Error('Sku is required');
});
```

**Aggregate** — private ctor, `static instantiate()` reserved for the factory,
private `props`, mutation methods enforce then `this.addEvent(new X(...))`;
use case drains with `pullEvents()`. Money via `Money.fromDecimal`.

**Factory (sole creation path; enforce + instantiate + raise initial event):**
```ts
export class ProductFactory {
  static create(input: CreateProductInput): Product {
    invariantRegistry.enforce('product.create', { ... });
    const product = Product.instantiate(ProductId.generate(), { ... }, 1);
    product.addEvent(new ProductCreated(product.id, product.sku, product.name, product.unitPrice, currency));
    return product;
  }
}
```
(`domain/factories/<name>.factory.ts` side-effect-imports
`'../aggregates/<name>.invariants'`, `'../value-objects/<x>.invariants'`, policies.)

**Command use case (the exact 6-step flow):**
```ts
@Injectable()
export class Create<X>UseCase {
  constructor(private readonly xs: XCommandRepository,
              private readonly integration: XIntegrationPort,
              private readonly companyConfig: CompanyConfigPort) {}
  @Transactional()
  async execute(input: Create<X>Request): Promise<XId> {
    const company = await this.companyConfig.getCompanyConfig();      // 1 context
    const x = XFactory.create({ ... });                               // 2 build+invariants
    const dup = await this.xs.findByUniq(x.uniq);                     // 3 pre-check → Conflict
    if (dup) throw new ConflictException(...);
    await this.xs.save(x);                                            // 4 persist
    for (const ev of x.pullEvents())                                  // 5 drain events
      await this.integration.send(ev, x.id.toString());               //   → OUTBOX via port
    return x.id;                                                      // 6 return id VO
  }
}
```
- `XIntegrationPort` = abstract `send(event: DomainEvent, id: string)`; the ONE
  implementation `OutboxAdapter` forwards to `OutboxWriterPort.append(event,'<Type>',id)`.
- Queries NEVER go through the aggregate: `XQuery` port implemented by
  `prisma-x-query.repository.ts` (constructor injects `PrismaReadPort`) returning `XQueryRecord`.

**Module-local outbound port (never import @platform in domain/usecases):**
```ts
// application/outbound-ports/company-config.port.ts
export abstract class CompanyConfigPort { abstract getCompanyConfig(): Promise<CompanyConfig>; }
// infrastructure/adapters/platform/company-config.adapter.ts → forwards the @platform token
// module: { provide: CompanyConfigPort, useClass: CompanyConfigAdapter }
```

**Cross-module reads (the purchase-order pattern):** local
`application/outbound-ports/product-query.port.ts` (e.g.
`PurchasableProductPort`) typed against the producer's `public/contracts/*.contract.ts`
data shape — implemented in `infrastructure/adapters/module/*.adapter.ts`, bound to
the producer's exported public port; the consumer's module `imports: [ProductModule]`.
Two acceptable transports: (a) public port + adapter (read paths) or (b) Rabbit listener
(write triggers, e.g. GRN receiving `PurchaseOrderApproved`). Never import another
module's internal path — lint enforces per-module blocked lists (§15 step 9 / eslint `businessModules`).

**Public surface:**
```ts
// public/contracts/x-for-y.contract.ts  — plain interface data, NO domain classes
export interface ProductReference { id: string; sku: string; name: string; unitPrice: Money… } // primitives/simple shapes
// public/ports: abstract class + public/index.ts re-exports both;
// module exports the port so PlatformModule-style consumers can bind it.
```

**Events + rehydrators (outbox in-process dispatch MUST survive async hop):**
```ts
// domain/events/product.registry.ts
domainEventRegistry.register('ProductCreated', payload => {
  const p = payload as unknown as { productId: { value: string }; unitPrice: { minorUnits: number; currency: string }; ... };
  return new ProductCreated(ProductId.fromString(p.productId.value), p.sku, p.name,
    Money.fromMinorUnits(p.unitPrice.minorUnits, p.unitPrice.currency), p.currency);
});
```

**Listener (application/integrations/listeners only):**
```ts
@Injectable()
export class XRabbitMQListener {
  @RabbitSubscribe({ exchange: 'erp.events', routingKey: 'XApproved', queue: 'x-approved.erp',
                     queueOptions: { durable: true } })
  onXApproved(message: IntegrationMessage): void {
    void this.transition.execute(message.aggregateId, ...);   // delegate to a use case
  }
}
```

**Controller/DTO (presentation/http):** zod `createZodDto`, request DTO one per
file; responses separate for web/mobile behind `@DeviceResponse(Web, Mobile)`;
controller returns `{ data, message }` (global ResponseInterceptor wraps).

**Prisma schema conventions (`prisma/schema/<ctx>/<name>.prisma`):** `@@map`
snake table, quoted `@map` columns, enums with `@map`, JSON `@db.JsonB` money columns
stored as `{minorUnits, amount, currency}` via `PrismaJson` helpers, and a header
comment documenting the table contract (all existing files do this — copy style).

## 4. Module bindings (exact style)

```ts
@Module({
  imports: [PlatformModule, <ProducerModule if consuming another public port>],
  controllers: [XController],
  providers: [
    CreateXUseCase, ListXsUseCase, …,
    PrismaXCommandRepository,
    { provide: XCommandRepository, useExisting: PrismaXCommandRepository },
    PrismaXQueryRepository,
    { provide: XQuery, useExisting: PrismaXQueryRepository },
    OutboxAdapter,
    { provide: XIntegrationPort, useExisting: OutboxAdapter },
    CompanyConfigAdapter, { provide: CompanyConfigPort, useExisting: CompanyConfigAdapter },
    // (opt-in platform features:) XBatchOperationAdapter — a provider that self-registers on its own onApplicationBootstrap; module class stays a pure @Module
  ],
  exports: [XForYPort],           // ONLY public ports (facades implement them inside)
})
export class XModule {}
```

## 5. Acceptance checklist

- [ ] `domain/**` contains zero `@nestjs/*` and no `@platform`/`@infrastructure` imports
- [ ] aggregates only mutated through factory + methods; repository ports speak domain types
- [ ] command path = use case + `@Transactional` + repository + `append` via integration port
  (NO direct broker/publish calls)
- [ ] reads on the query port + replica client; no aggregate hydration in query repos
- [ ] every persisted event has a rehydrator in `<name>.registry.ts`
      (the outbox re-dispatch restores rehydrated instances via `outboxEventRegistry` delegates — see the platform guide §Events)
- [ ] cross-module ONLY via `public/` contract + local outbound port (lint-enforced)
- [ ] module added to `businessModules` in eslint.config.mjs + to context root
- [ ] new module listed in §4/§7 docs (`ARCHITECTURE.md`) when it joins a context
- [ ] `npm run lint:check && npx tsc --noEmit && npm test` green; add aggregate spec + use case spec
- [ ] `npm run docs:di` regenerated if the module graph changed

## 6. Known gaps in current modules (fix, don't copy)

- Business tables have no `tenantId` column yet (single shared instance by design today);
  per-tenant migration is explicitly deferred (see ARCHITECTURE §13 "…open work");
  new module schemas MUST reserve it only when its tables become tenant-owned.
- `version` columns are persisted but not yet CAS-guarded in `save/update`
  (same deferred work — don't copy the gap silently into new modules either:
  when you add the migration, gate updates on `(id, version)` in the command repo.)

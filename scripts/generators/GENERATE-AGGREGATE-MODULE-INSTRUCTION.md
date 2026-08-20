# Aggregate Module Generator — Input System

A **config-driven, regeneratable** code generator for NestJS DDD business modules.

---

## Philosophy

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR INPUT CONFIG                     │
│              (the single source of truth)                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   GENERATOR    │
              │  (runs anytime)│
              └───────┬────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
  ┌──────────────┐      ┌──────────────────┐
  │  @generated  │      │     @custom      │
  │   files      │      │     files        │
  │              │      │                  │
  │  READONLY    │      │  EDITABLE        │
  │  Overwritten │      │  Preserved       │
  │  on regen    │      │  across regen    │
  └──────────────┘      └──────────────────┘
```

**Three rules:**

1. **Config is the source of truth.** Every generated file comes from the config. If you want to change a generated file, change the config and regenerate — never edit the file directly.

2. **Generated files are readonly.** They carry a `// @generated` header. The generator overwrites them on every run. Manual edits are lost.

3. **Invariant and policy files are the only editable files.** They carry a `// @custom` header. The generator creates them if missing, but **never overwrites** existing ones. These are where you hand-code business rules.

---

## Table of Contents

1. [How Regeneration Works](#1-how-regeneration-works)
2. [File Markers](#2-file-markers)
3. [Input Config Schema](#3-input-config-schema)
4. [Field Reference](#4-field-reference)
5. [Example Config](#5-example-config)
6. [Generated File Tree](#6-generated-file-tree)
7. [Naming Conventions](#7-naming-conventions)

---

## 1. How Regeneration Works

```bash
# First generation — creates all files
npx tsx scripts/generators/aggregate.generator.ts --config configs/purchase-order.config.ts

# You hand-code invariants and policies...

# Later — add a property, change a use case, update config
# Then regenerate — only @generated files are overwritten
npx tsx scripts/generators/aggregate.generator.ts --config configs/purchase-order.config.ts

# Force overwrite EVERYTHING (destroys hand-coded invariants/policies)
npx tsx scripts/generators/aggregate.generator.ts --config configs/purchase-order.config.ts --force
```

**What happens on regeneration:**

| File has `@generated` | File has `@custom` | File doesn't exist | Action |
|---|---|---|---|
| ✅ | — | — | Overwrite |
| — | ✅ | — | Skip (preserve) |
| — | — | ✅ | Create |
| ✅ | ✅ | — | Skip (shouldn't happen) |

---

## 2. File Markers

Every generated file starts with a marker comment:

```ts
// @generated — DO NOT EDIT. Update input config and regenerate.
// Source: scripts/generators/configs/purchase-order.config.ts
```

Every custom file starts with:

```ts
// @custom — Edit freely. This file is preserved across regenerations.
// Source: scripts/generators/configs/purchase-order.config.ts
```

The generator reads the first line of existing files to decide whether to overwrite.

---

## 3. Input Config Schema

```ts
interface AggregateModuleConfig {
  // ══════════════════════════════════════════════════════════════════════
  // IDENTITY — where and what to generate
  // ══════════════════════════════════════════════════════════════════════
  name: string;                  // kebab-case: 'purchase-order'
  context: string;               // bounded context: 'procurement'
  displayName: string;           // human label: 'Purchase Order'
  entityName: string;            // PascalCase class: 'PurchaseOrder'
  entityNamePlural: string;      // PascalCase plural: 'PurchaseOrders'

  // ══════════════════════════════════════════════════════════════════════
  // DOMAIN SHAPE — what the aggregate looks like
  // ══════════════════════════════════════════════════════════════════════
  properties: PropertyConfig[];
  valueObjects?: ValueObjectConfig[];
  childEntities?: ChildEntityConfig[];
  states?: string[];
  events: EventConfig[];
  statusTransitions?: StatusTransitionConfig[];

  // ══════════════════════════════════════════════════════════════════════
  // BEHAVIOR — what the aggregate does
  // ══════════════════════════════════════════════════════════════════════
  useCases?: UseCaseConfig[];
  outboundPorts?: OutboundPortConfig[];
  inboundPorts?: InboundPortConfig[];

  // ══════════════════════════════════════════════════════════════════════
  // PERSISTENCE — database shape
  // ══════════════════════════════════════════════════════════════════════
  prismaModel?: PrismaModelConfig;

  // ══════════════════════════════════════════════════════════════════════
  // OPTIONS — fine-tune generation
  // ══════════════════════════════════════════════════════════════════════
  options?: ModuleOptions;
}
```

---

## 4. Field Reference

### 4.1 Identity

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Kebab-case module name. Drives file names, API routes, Prisma tables. |
| `context` | `string` | ✅ | Bounded context folder: `catalog`, `party`, `procurement`. |
| `displayName` | `string` | ✅ | Human-readable label for comments and logs. |
| `entityName` | `string` | ✅ | PascalCase aggregate root class name. |
| `entityNamePlural` | `string` | ✅ | PascalCase plural for lists and controller routes. |

**Derivations from `name`:**

```
name = 'purchase-order'
  camel      → purchaseOrder
  pascal     → PurchaseOrder
  kebab      → purchase-order
  filePrefix → purchase-order.
  route      → /api/v1/purchase-orders
  prismaTable→ purchase_orders
```

---

### 4.2 Properties

State fields on the aggregate root.

```ts
interface PropertyConfig {
  name: string;              // camelCase: 'orderNumber'
  type: PropertyType;        // see table
  required?: boolean;        // default: false
  maxLength?: number;        // for string/text
  defaultValue?: unknown;    // used in factory + Prisma
}

type PropertyType =
  | 'string'    // Prisma String
  | 'text'      // Prisma String (nullable)
  | 'money'     // Money value object (minorUnits + currency)
  | 'boolean'   // Prisma Boolean
  | 'number'    // Prisma Int/Float
  | 'date'      // Prisma DateTime
  | 'enum'      // TypeScript string union
  | 'json'      // Prisma Json
  | 'id';       // UUID string (foreign key)
```

**Type mapping:**

| Type | Domain Type | Prisma Column | DTO Input |
|---|---|---|---|
| `string` | `string` | `String` | `string` |
| `text` | `string \| null` | `String?` | `string?` |
| `money` | `Money` | `Decimal` + `currency: String` | `number` |
| `boolean` | `boolean` | `Boolean` | `boolean` |
| `number` | `number` | `Int` or `Float` | `number` |
| `date` | `Date` | `DateTime` | `string` (ISO) |
| `enum` | `string` | `String` | `string` |
| `json` | `Record<string, unknown>` | `Json` | `object` |
| `id` | `string` | `String` (UUID) | `string` |

---

### 4.3 Value Objects

Immutable, self-validating wrappers around primitives.

```ts
interface ValueObjectConfig {
  name: string;                // PascalCase: 'Sku', 'OrderNumber'
  wraps: PropertyType;         // primitive it wraps
  normalize?: string;          // 'uppercase' | 'trim' | 'trim-uppercase' | 'none'
}
```

**Generated files:**

| File | Marker | Contents |
|---|---|---|
| `<kebab>.vo.ts` | `@generated` | VO class: constructor, `create()`, `value` getter |
| `<kebab>.invariants.ts` | `@custom` | Empty scaffold — you hand-code validation rules |

---

### 4.4 Child Entities

Entities owned by the aggregate root.

```ts
interface ChildEntityConfig {
  name: string;                  // PascalCase: 'PurchaseOrderLine'
  properties: PropertyConfig[];  // no id/status/dates
  methods?: ChildMethodConfig[];
}

interface ChildMethodConfig {
  name: string;
  params: { name: string; type: string }[];
  returnType: string;
}
```

**Generated:** `<kebab>-<child-kebab>.entity.ts` (`@generated`)

---

### 4.5 States

Lifecycle status enum values.

```ts
states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']
```

**Generated files:**

| File | Marker | Contents |
|---|---|---|
| `<name>.enum.ts` | `@generated` | TypeScript enum |
| `<name>.aggregate.ts` | `@generated` | Transition method stubs with `// TODO: add guards` |
| `<name>.invariants.ts` | `@custom` | Empty scaffold — you hand-code transition rules |

If `states` is omitted: no enum, no transitions, no status-related files.

---

### 4.6 Events

Domain events raised by the aggregate.

```ts
interface EventConfig {
  name: string;           // suffix: 'Created', 'Submitted'
  fields?: string[];      // extra payload beyond entity ID
}
```

**Auto-prefixed with `entityName`:**

```
entityName = 'PurchaseOrder', name = 'Submitted'
  → class: PurchaseOrderSubmitted
  → file: purchase-order.submitted.event.ts
  → registry key: 'PurchaseOrderSubmitted'
```

**Generated files (all `@generated`):**

| File | Contents |
|---|---|
| `<name>.<event>.event.ts` | Event class extending `DomainEvent` |
| `<name>.registry.ts` | Rehydrator registrations for outbox |

**Standard events (if `states` is defined):**

| Event | Extra Fields |
|---|---|
| `Created` | required properties |
| `Updated` | none |
| `Activated` | none |
| `Deactivated` | none |

---

### 4.7 Status Transitions

State machine edges. Generator creates method stubs; you add business guards.

```ts
interface StatusTransitionConfig {
  from: string;        // source status
  to: string;          // target status
  method?: string;     // method name (default: kebab `to`)
}
```

**Generated in aggregate (`@generated`):**

```ts
// @generated — DO NOT EDIT. Update input config and regenerate.
submit(): void {
  // @custom-guard — add your business rules here
  invariantRegistry.enforce('purchase-order.status-transition', {
    status: this.props.status,
    to: PurchaseOrderStatus.SUBMITTED,
  });
  this.props.status = PurchaseOrderStatus.SUBMITTED;
  this.props.updatedAt = new Date();
  this.addEvent(new PurchaseOrderSubmitted(this.id, this.props.orderNumber.value, this.vendorId));
}
```

The `// @custom-guard` marker inside the generated method tells you where to add hand-coded logic. On regeneration, the method body is overwritten BUT the generator preserves any code between `// @custom-guard` markers.

**Generated in invariants (`@custom`):**

```ts
// @custom — Edit freely. This file is preserved across regenerations.
invariantRegistry.register<{ status: PurchaseOrderStatus; to: PurchaseOrderStatus }>(
  'purchase-order.status-transition',
  {
    name: 'purchase-order-valid-status-transition',
    check: ({ status, to }) => {
      if (status === to) return;
      const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
        // TODO: fill in your allowed transitions
      };
      if (!allowed[status]?.includes(to)) {
        throw Object.assign(new Error(`Invalid transition: ${status} -> ${to}`), { statusCode: 422 });
      }
    },
  },
);
```

---

### 4.8 Use Cases

Custom use cases beyond standard CRUD.

```ts
interface UseCaseConfig {
  name: string;                    // PascalCase: 'ChangePrice', 'SubmitOrder'
  type: 'command' | 'query';
  description?: string;
  inputFields?: PropertyConfig[];
  returnType?: string;             // default: entityName + 'Id'
  injects?: string[];              // additional ports
  transactional?: boolean;         // default: true for commands
}
```

**Standard use cases (always generated unless `options.skipCrud`):**

| Use Case | Type |
|---|---|
| `Create<Entity>` | command |
| `Update<Entity>` | command |
| `Get<Entity>` | query |
| `List<Entities>` | query |

If `states` is defined: `<Entity>StatusUseCase`.

**Generated:** `<name>.<use-case>.usecase.ts` (`@generated`)

---

### 4.9 Cross-Module Ports

#### Outbound (this module consumes)

```ts
interface OutboundPortConfig {
  name: string;
  portClassName: string;     // abstract class name
  methods: {
    name: string;
    returnType: string;
    params?: { name: string; type: string }[];
  }[];
}
```

#### Inbound (this module exposes)

```ts
interface InboundPortConfig {
  name: string;
  portClassName: string;
  methods: {
    name: string;
    returnType: string;
    params?: { name: string; type: string }[];
  }[];
  implementsWith?: string;   // use case that implements it
}
```

**Generated (all `@generated`):**

| File | Contents |
|---|---|
| `outbound/<name>.port.ts` | Abstract class |
| `adapters/<name>.adapter.ts` | Adapter implementation |
| Module binding + export | In `<name>.module.ts` |

---

### 4.10 Prisma Model

```ts
interface PrismaModelConfig {
  modelName: string;
  tableName?: string;
  fields: {
    name: string;
    type: string;          // String, Int, Float, Boolean, DateTime, Json, Decimal
    id?: boolean;
    unique?: boolean;
    required?: boolean;    // default: true
    default?: unknown;
    relation?: string;
    relationFields?: string[];
  }[];
  indexes?: {
    fields: string[];
    unique?: boolean;
  }[];
  enums?: {
    name: string;
    values: string[];
  }[];
}
```

**Generated:** `prisma/schema/<name>.prisma` (`@generated`)

---

### 4.11 Module Options

```ts
interface ModuleOptions {
  skipConsumers?: boolean;          // don't generate consumer files
  skipSwagger?: boolean;            // no @ApiTags / @ApiOperation
  skipSpecFiles?: boolean;          // no .spec.ts files
  skipCrud?: boolean;               // skip standard CRUD use cases
  customModuleFile?: boolean;       // don't overwrite module file
  enablePagination?: boolean;       // PageQuery/PageResult in list use case
  enableVersioning?: boolean;       // API version prefix
  outboxEnabled?: boolean;          // default: true
  companyConfigEnabled?: boolean;   // default: true
}
```

---

## 5. Example Config

```ts
// configs/purchase-order.config.ts
import type { AggregateModuleConfig } from '../aggregate.generator';

const config: AggregateModuleConfig = {
  name: 'purchase-order',
  context: 'procurement',
  displayName: 'PurchaseOrder',
  entityName: 'PurchaseOrder',
  entityNamePlural: 'PurchaseOrders',

  properties: [
    { name: 'orderNumber', type: 'string', required: true },
    { name: 'vendorId',    type: 'id',     required: true },
    { name: 'currency',    type: 'string', required: false, defaultValue: 'USD' },
  ],

  valueObjects: [
    { name: 'OrderNumber', wraps: 'string', normalize: 'trim-uppercase' },
    { name: 'VendorIdRef', wraps: 'id', normalize: 'none' },
    { name: 'ProductIdRef', wraps: 'id', normalize: 'none' },
  ],

  childEntities: [
    {
      name: 'PurchaseOrderLine',
      properties: [
        { name: 'productId', type: 'id', required: true },
        { name: 'quantity',  type: 'number', required: true },
        { name: 'unitPrice', type: 'money', required: true },
        { name: 'total',     type: 'money', required: true },
      ],
      methods: [
        {
          name: 'withUpdatedQuantity',
          params: [
            { name: 'quantity', type: 'number' },
            { name: 'unitPrice', type: 'Money' },
            { name: 'total', type: 'Money' },
          ],
          returnType: 'PurchaseOrderLine',
        },
      ],
    },
  ],

  states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],

  events: [
    { name: 'Created',     fields: ['orderNumber', 'vendorId'] },
    { name: 'LineAdded',   fields: ['productId'] },
    { name: 'LineRemoved', fields: ['productId'] },
    { name: 'Submitted',   fields: ['orderNumber', 'vendorId'] },
    { name: 'Approved' },
    { name: 'Rejected',    fields: ['reason'] },
    { name: 'Cancelled' },
    { name: 'Completed' },
  ],

  statusTransitions: [
    { from: 'DRAFT',     to: 'SUBMITTED',  method: 'submit' },
    { from: 'SUBMITTED', to: 'APPROVED',   method: 'approve' },
    { from: 'SUBMITTED', to: 'REJECTED',   method: 'reject' },
    { from: 'SUBMITTED', to: 'CANCELLED',  method: 'cancel' },
    { from: 'APPROVED',  to: 'COMPLETED',  method: 'complete' },
  ],

  useCases: [
    {
      name: 'AddPurchaseOrderLine',
      type: 'command',
      inputFields: [
        { name: 'id',        type: 'string' },
        { name: 'productId', type: 'string' },
        { name: 'quantity',  type: 'number' },
        { name: 'unitPrice', type: 'money' },
      ],
    },
    {
      name: 'RemovePurchaseOrderLine',
      type: 'command',
      inputFields: [
        { name: 'id',        type: 'string' },
        { name: 'productId', type: 'string' },
      ],
    },
  ],

  outboundPorts: [
    {
      name: 'VendorQuery',
      portClassName: 'OrderableVendorQueryPort',
      methods: [
        { name: 'getOrderableVendor', returnType: 'Promise<VendorReference | null>' },
      ],
    },
    {
      name: 'ProductQuery',
      portClassName: 'PurchasableProductQueryPort',
      methods: [
        { name: 'getPurchasableProduct', returnType: 'Promise<ProductReference | null>' },
      ],
    },
  ],

  prismaModel: {
    modelName: 'PurchaseOrder',
    fields: [
      { name: 'id',          type: 'String',   id: true },
      { name: 'orderNumber', type: 'String',   unique: true },
      { name: 'vendorId',    type: 'String' },
      { name: 'status',      type: 'String' },
      { name: 'currency',    type: 'String',   required: false, defaultValue: "'USD'" },
      { name: 'createdAt',   type: 'DateTime' },
      { name: 'updatedAt',   type: 'DateTime' },
      { name: 'version',     type: 'Int',      defaultValue: '1' },
    ],
    indexes: [
      { fields: ['orderNumber'], unique: true },
      { fields: ['vendorId'] },
      { fields: ['status'] },
    ],
  },

  options: {
    enablePagination: true,
  },
};

export default config;
```

---

## 6. Generated File Tree

```
src/business/procurement/purchase/
│
│  ┌─── @generated (readonly, overwritten on regen) ──────────────────┐
│  │                                                                   │
├── purchase-order.module.ts                                          │
├── index.ts                                                          │
│                                                                     │
├── domain/                                                           │
│   ├── entities/                                                     │
│   │   ├── purchase-order.aggregate.ts                               │
│   │   ├── purchase-order.aggregate.spec.ts                          │
│   │   └── purchase-order-line.entity.ts                             │
│   │                                                                 │
│   ├── types/                                                        │
│   │   ├── purchase-order.enum.ts                                    │
│   │   └── purchase-order.types.ts                                   │
│   │                                                                 │
│   ├── value-objects/                                                │
│   │   ├── purchase-order-id.vo.ts                                   │
│   │   ├── order-number.vo.ts                                        │
│   │   ├── vendor-id-ref.vo.ts                                       │
│   │   ├── product-id-ref.vo.ts                                      │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   ├── events/                                                       │
│   │   ├── purchase-order.created.event.ts                           │
│   │   ├── purchase-order.submitted.event.ts                         │
│   │   ├── purchase-order.approved.event.ts                          │
│   │   ├── purchase-order.rejected.event.ts                          │
│   │   ├── purchase-order.cancelled.event.ts                         │
│   │   ├── purchase-order.completed.event.ts                         │
│   │   ├── purchase-order.line-added.event.ts                        │
│   │   ├── purchase-order.line-removed.event.ts                      │
│   │   ├── purchase-order.registry.ts                                │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   ├── factories/                                                    │
│   │   ├── purchase-order.factory.ts                                 │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   ├── ports/                                                        │
│   │   ├── purchase-order-command-repository.port.ts                 │
│   │   ├── purchase-order-query-repository.port.ts                   │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   └── errors/                                                       │
│                                                                     │
├── application/                                                      │
│   ├── usecase/                                                      │
│   │   ├── create-purchase-order.usecase.ts                          │
│   │   ├── update-purchase-order.usecase.ts                          │
│   │   ├── purchase-order-transition.usecase.ts                      │
│   │   ├── add-purchase-order-line.usecase.ts                        │
│   │   ├── remove-purchase-order-line.usecase.ts                     │
│   │   ├── get-purchase-order.usecase.ts                             │
│   │   ├── list-purchase-orders.usecase.ts                           │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   ├── consumers/                                                    │
│   │   ├── purchase-order.event-emitter.consumer.ts                  │
│   │   ├── purchase-order.kafka.consumer.ts                          │
│   │   ├── purchase-order.rabbitmq.consumer.ts                       │
│   │   ├── purchase-order.sqs.consumer.ts                            │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   ├── adapters/                                                     │
│   │   └── index.ts                                                  │
│   │                                                                 │
│   └── ports/                                                        │
│       └── outbound/                                                 │
│           ├── purchase-order-vendor-query.port.ts                   │
│           ├── purchase-order-product-query.port.ts                  │
│           └── index.ts                                              │
│                                                                     │
├── infrastructure/                                                   │
│   └── persistence/                                                  │
│       ├── purchase-order.mapper.ts                                  │
│       ├── prisma-purchase-order-command.repository.ts               │
│       ├── prisma-purchase-order-query.repository.ts                 │
│       └── index.ts                                                  │
│                                                                     │
└── presentation/                                                     │
    └── http/                                                         │
        ├── controllers/                                              │
        │   └── purchase-order.controller.ts                          │
        └── request/                                                  │
            └── purchase-order.request.ts                             │
│                                                                     │
│  └──────────────────────────────────────────────────────────────────┘
│
│  ┌─── @custom (editable, preserved across regen) ──────────────────┐
│  │                                                                   │
├── domain/                                                           │
│   ├── entities/                                                     │
│   │   └── purchase-order.invariants.ts            ← hand-code       │
│   │                                                                 │
│   ├── value-objects/                                                │
│   │   └── order-number.invariants.ts              ← hand-code       │
│   │                                                                 │
│   └── policies/                                                     │
│       └── purchase-order.policy.ts                ← hand-code       │
│                                                                     │
│  └──────────────────────────────────────────────────────────────────┘

prisma/schema/
└── purchase-order.prisma                         ← @generated
```

---

## 7. Naming Conventions

| Artifact | Pattern | Example |
|---|---|---|
| Module class | `<EntityName>Module` | `PurchaseOrderModule` |
| Module file | `<name>.module.ts` | `purchase-order.module.ts` |
| Aggregate | `<entity-name>.aggregate.ts` | `purchase-order.aggregate.ts` |
| Enum | `<name>.enum.ts` | `purchase-order.enum.ts` |
| Types | `<name>.types.ts` | `purchase-order.types.ts` |
| ID VO | `<entity-name>-id.vo.ts` | `purchase-order-id.vo.ts` |
| Other VOs | `<kebab>.vo.ts` | `order-number.vo.ts` |
| VO invariants | `<kebab>.invariants.ts` | `order-number.invariants.ts` |
| Aggregate invariants | `<name>.invariants.ts` | `purchase-order.invariants.ts` |
| Policy | `<name>.policy.ts` | `purchase-order.policy.ts` |
| Event | `<name>.<event>.event.ts` | `purchase-order.submitted.event.ts` |
| Registry | `<name>.registry.ts` | `purchase-order.registry.ts` |
| Factory | `<entity-name>.factory.ts` | `purchase-order.factory.ts` |
| Command repo port | `<name>-command-repository.port.ts` | `purchase-order-command-repository.port.ts` |
| Query repo port | `<name>-query-repository.port.ts` | `purchase-order-query-repository.port.ts` |
| Use case | `<name>.<use-case>.usecase.ts` | `purchase-order-transition.usecase.ts` |
| Consumer | `<name>.<broker>.consumer.ts` | `purchase-order.kafka.consumer.ts` |
| Controller | `<name>.controller.ts` | `purchase-order.controller.ts` |
| Request DTO | `<name>.request.ts` | `purchase-order.request.ts` |
| Mapper | `<name>.mapper.ts` | `purchase-order.mapper.ts` |
| Prisma repo | `prisma-<entity>-command.repository.ts` | `prisma-purchase-order-command.repository.ts` |
| Prisma model | `<name>.prisma` | `purchase-order.prisma` |

---

## CLI

```bash
# Generate (creates or regenerates)
npx tsx scripts/generators/aggregate.generator.ts \
  --config scripts/generators/configs/purchase-order.config.ts

# Force overwrite everything (destroys hand-coded files)
npx tsx scripts/generators/aggregate.generator.ts \
  --config scripts/generators/configs/purchase-order.config.ts \
  --force

# Dry run (show what would be created/overwritten)
npx tsx scripts/generators/aggregate.generator.ts \
  --config scripts/generators/configs/purchase-order.config.ts \
  --dry-run

# Sync barrel indexes only
npx tsx scripts/generators/sync-barrels.ts
```

# Generate Aggregate Module — Instruction Guide

This document defines the **complete input schema** for generating a business aggregate
module. Every field listed here is what the generator tool needs to produce a fully
working, production-ready NestJS DDD module that follows the project's architecture.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Input Schema Reference](#2-input-schema-reference)
3. [Field-by-Field Explanation](#3-field-by-field-explanation)
4. [Complete Example](#4-complete-example)
5. [What Gets Generated](#5-what-gets-generated)
6. [Naming Conventions](#6-naming-conventions)

---

## 1. Overview

The generator takes a single configuration object and produces a complete business module
under `src/business/<context>/<module>/` with all four layers:

```
domain/          → entities, value objects, events, invariants, policies, factories, ports, types, errors
application/     → use cases, consumers, adapters, outbound ports
infrastructure/  → Prisma repositories + domain↔model mapper
presentation/    → HTTP controllers + request DTOs
```

Plus the NestJS module file, barrel indexes, and optionally a Prisma schema file.

---

## 2. Input Schema Reference

```ts
interface AggregateModuleConfig {
  // ── Identity ──────────────────────────────────────────────────────────
  name: string;                  // kebab-case module name
  context: string;               // bounded context (catalog, party, procurement)
  displayName: string;           // human-readable label
  entityName: string;            // PascalCase singular (the aggregate root class name)
  entityNamePlural: string;      // PascalCase plural (for lists, controllers)

  // ── Domain Properties ─────────────────────────────────────────────────
  properties: PropertyConfig[];  // aggregate properties (state fields)
  valueObjects?: ValueObjectConfig[];  // typed value objects with optional invariants
  childEntities?: ChildEntityConfig[]; // child entities owned by the aggregate

  // ── Lifecycle ─────────────────────────────────────────────────────────
  states?: string[];             // status enum values (e.g. ['ACTIVE','INACTIVE'])

  // ── Events ────────────────────────────────────────────────────────────
  events: EventConfig[];         // domain events raised by the aggregate

  // ── Invariants ────────────────────────────────────────────────────────
  invariants?: InvariantConfig[];      // aggregate-level invariants
  statusTransitions?: StatusTransitionConfig[];  // allowed state machine edges

  // ── Policies ──────────────────────────────────────────────────────────
  policies?: PolicyConfig[];     // business policies (evaluated, not thrown)

  // ── Use Cases ─────────────────────────────────────────────────────────
  useCases?: UseCaseConfig[];    // custom use cases beyond standard CRUD

  // ── Cross-Module Ports ────────────────────────────────────────────────
  outboundPorts?: OutboundPortConfig[];  // ports this module consumes from others
  inboundPorts?: InboundPortConfig[];    // ports this module exposes to others

  // ── Persistence ───────────────────────────────────────────────────────
  prismaModel?: PrismaModelConfig;  // Prisma schema definition

  // ── Module Options ────────────────────────────────────────────────────
  options?: ModuleOptions;
}
```

---

## 3. Field-by-Field Explanation

### 3.1 Identity

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | Kebab-case module name. Used for file names, API routes, Prisma models. Examples: `'product'`, `'purchase-order'`, `'vendor'` |
| `context` | `string` | ✅ | Bounded context this module belongs to. Determines the parent folder. Examples: `'catalog'`, `'party'`, `'procurement'` |
| `displayName` | `string` | ✅ | Human-readable name for logs, comments, docs. Examples: `'Product'`, `'Purchase Order'` |
| `entityName` | `string` | ✅ | PascalCase singular — the aggregate root class name. Must match what you'd name the class. Examples: `'Product'`, `'PurchaseOrder'`, `'Vendor'` |
| `entityNamePlural` | `string` | ✅ | PascalCase plural — used in list use cases, controller tags. Examples: `'Products'`, `'PurchaseOrders'`, `'Vendors'` |

**Naming relationships:**

```
name = 'purchase-order'
  → kebab: 'purchase-order'
  → camel: 'purchaseOrder'
  → pascal: 'PurchaseOrder'
  → file prefix: 'purchase-order.'
  → Prisma model: 'PurchaseOrder' (PascalCase) / table: 'purchase_orders' (snake_case plural)
  → API route: '/api/v1/purchase-orders'
```

---

### 3.2 Properties (State Fields)

Each property represents a stateful field on the aggregate root.

```ts
interface PropertyConfig {
  name: string;              // camelCase field name
  type: PropertyType;        //see below
  required?: boolean;        // default: false
  maxLength?: number;        // for string/text types
  defaultValue?: unknown;    // default value if not provided during creation
  description?: string;      // documentation
}

type PropertyType =
  | 'string'      // short string (e.g. name, code, sku) — maps to Prisma String
  | 'text'        // long text (e.g. description, address) — maps to Prisma String
  | 'money'       // monetary amount — uses Money value object (minorUnits + currency)
  | 'boolean'     // true/false — maps to Prisma Boolean
  | 'number'      // integer/float — maps to Prisma Int or Float
  | 'date'        // date/time — maps to Prisma DateTime
  | 'enum'        // string enum — requires `values` array
  | 'json'        // JSON object — maps to Prisma Json
  | 'id';         // foreign key reference (stored as string UUID)
```

**What the generator does with each type:**

| Type | Domain | Persistence | Input DTO |
|---|---|---|---|
| `string` | `string` | `String` | `string` |
| `text` | `string \| null` | `String?` | `string?` |
| `money` | `Money` (value object) | `Decimal` + currency column | `number` (amount) |
| `boolean` | `boolean` | `Boolean` | `boolean` |
| `number` | `number` | `Int` or `Float` | `number` |
| `date` | `Date` | `DateTime` | `string` (ISO) |
| `enum` | `string` (the enum type) | `String` (enum name) | `string` |
| `json` | `Record<string, unknown>` | `Json` | `object` |
| `id` | `string` | `String` (UUID) | `string` |

**Example — Product properties:**

```ts
properties: [
  { name: 'sku',         type: 'string', required: true },
  { name: 'name',        type: 'string', required: true, maxLength: 200 },
  { name: 'unitPrice',   type: 'money',  required: true },
  { name: 'description', type: 'text' },
  { name: 'isActive',    type: 'boolean', defaultValue: true },
]
```

---

### 3.3 Value Objects

Value objects are immutable, self-validating types that wrap primitive values. Each gets
its own file with optional invariants.

```ts
interface ValueObjectConfig {
  name: string;                // PascalCase class name (e.g. 'Sku', 'ProductName', 'OrderNumber')
  wraps: PropertyType;         // what primitive it wraps ('string', 'money', etc.)
  normalize?: string;          // normalization rule: 'uppercase', 'trim', 'trim-uppercase', 'none'
  invariants?: ValueObjectInvariantConfig[];
}

interface ValueObjectInvariantConfig {
  name: string;                // kebab-case invariant name (e.g. 'sku-format')
  description?: string;        // what the invariant checks
  rules: InvariantRule[];      // validation rules
}

interface InvariantRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: string | number | RegExp;  // for pattern/minLength/maxLength
  message: string;             // error message on failure
}
```

**What gets generated:**

- `domain/value-objects/<kebab>.vo.ts` — the ValueObject class
- `domain/value-objects/<kebab>.invariants.ts` — invariant registrations (if rules provided)

**Example:**

```ts
valueObjects: [
  {
    name: 'Sku',
    wraps: 'string',
    normalize: 'trim-uppercase',
    invariants: [
      {
        name: 'sku-format',
        rules: [
          { type: 'required', message: 'SKU cannot be empty' },
          { type: 'minLength', value: 2, message: 'SKU must be at least 2 characters' },
          { type: 'maxLength', value: 64, message: 'SKU must be at most 64 characters' },
          { type: 'pattern', value: /^[A-Z0-9-]+$/, message: 'SKU must be letters, digits or dashes' },
        ],
      },
    ],
  },
  {
    name: 'ProductName',
    wraps: 'string',
    normalize: 'trim',
    invariants: [
      {
        name: 'product-name-length',
        rules: [
          { type: 'required', message: 'Product name cannot be empty' },
          { type: 'maxLength', value: 200, message: 'Product name cannot exceed 200 characters' },
        ],
      },
    ],
  },
]
```

---

### 3.4 Child Entities

Entities owned by the aggregate root (e.g. `PurchaseOrderLine` inside `PurchaseOrder`).

```ts
interface ChildEntityConfig {
  name: string;                  // PascalCase class name (e.g. 'PurchaseOrderLine')
  properties: PropertyConfig[];  // child entity properties (no id, no status, no dates)
  methods?: ChildMethodConfig[]; // domain methods on the child entity
}

interface ChildMethodConfig {
  name: string;                  // method name (e.g. 'withUpdatedQuantity')
  params: { name: string; type: string }[];
  returnType: string;
}
```

**What gets generated:**

- `domain/entities/<kebab>-<child-kebab>.entity.ts`

---

### 3.5 Status / Lifecycle States

If the aggregate has a lifecycle status, define the enum values.

```ts
states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']
```

**What gets generated:**

- `domain/types/<kebab>.enum.ts` — the TypeScript enum
- Status transition logic in the aggregate (activate/deactivate or custom transitions)
- Status transition invariant registration

If `states` is omitted, no status enum is generated and the aggregate has no lifecycle.

---

### 3.6 Events

Domain events raised by the aggregate. Each event becomes a class and gets registered
in the domain event registry.

```ts
interface EventConfig {
  name: string;           // PascalCase event name suffix (e.g. 'Created', 'Submitted')
  fields?: string[];      // extra payload fields beyond the aggregate ID
  description?: string;   // documentation
}
```

**The generator automatically prefixes the event name with `entityName`:**

```
entityName = 'PurchaseOrder', event.name = 'Submitted'
  → class: PurchaseOrderSubmitted
  → file: purchase-order.submitted.event.ts
  → registry key: 'PurchaseOrderSubmitted'
```

**Standard events (always generated if `states` is defined):**

| Event | When | Extra Fields |
|---|---|---|
| `Created` | Factory creates aggregate | all required properties |
| `Updated` | `update()` method called | none |
| `Activated` | `activate()` called | none |
| `Deactivated` | `deactivate()` called | none |

**Custom events (user-defined):**

```ts
events: [
  { name: 'Created', fields: ['sku', 'name', 'unitPrice', 'currency'] },
  { name: 'Updated' },
  { name: 'Submitted', fields: ['orderNumber', 'vendorId'] },
  { name: 'Approved' },
  { name: 'Rejected', fields: ['reason'] },
  { name: 'Cancelled' },
  { name: 'LineAdded', fields: ['productId'] },
  { name: 'LineRemoved', fields: ['productId'] },
]
```

**What gets generated per event:**

- `domain/events/<kebab>.<event-kebab>.event.ts` — event class extending `DomainEvent`
- Registration in `domain/events/<kebab>.registry.ts` — rehydrator for outbox

---

### 3.7 Invariants

Aggregate-level invariant rules enforced during domain operations.

```ts
interface InvariantConfig {
  operation: string;        // when to check: 'create', 'update', or custom operation name
  name: string;             // kebab-case unique name (e.g. 'product-price-non-negative')
  field?: string;           // which field to validate (optional, for simple cases)
  rules: InvariantRule[];   // same rule types as value object invariants
  customCheck?: string;     // pseudo-code description for complex logic (generator adds TODO)
}
```

**What gets generated:**

- Invariant registrations in `domain/entities/<kebab>.invariants.ts`

**Example:**

```ts
invariants: [
  {
    operation: 'create',
    name: 'product-price-non-negative',
    field: 'unitPrice',
    rules: [
      { type: 'custom', message: 'Product price cannot be negative', value: '>= 0' },
    ],
  },
]
```

---

### 3.8 Status Transitions

Define the state machine edges explicitly.

```ts
interface StatusTransitionConfig {
  from: string;        // source status
  to: string;          // target status
  method?: string;     // aggregate method name (default: auto-generated from 'to')
  guard?: string;      // additional guard description (adds TODO)
}
```

**What gets generated:**

- Transition method on the aggregate (e.g. `submit()`, `approve()`, `reject()`)
- Status transition invariant with the allowed edges map
- Corresponding domain event for each transition

**Example:**

```ts
statusTransitions: [
  { from: 'DRAFT',     to: 'SUBMITTED',  method: 'submit' },
  { from: 'SUBMITTED', to: 'APPROVED',   method: 'approve' },
  { from: 'SUBMITTED', to: 'REJECTED',   method: 'reject', guard: 'requires reason' },
  { from: 'SUBMITTED', to: 'CANCELLED',  method: 'cancel' },
  { from: 'APPROVED',  to: 'COMPLETED',  method: 'complete' },
]
```

This generates:

```ts
// In the aggregate:
submit(): void { ... }
approve(): void { ... }
reject(reason: string): void { ... }
cancel(): void { ... }
complete(): void { ... }

// In invariants:
const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  [PurchaseOrderStatus.DRAFT]: [PurchaseOrderStatus.SUBMITTED],
  [PurchaseOrderStatus.SUBMITTED]: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.REJECTED, PurchaseOrderStatus.CANCELLED],
  [PurchaseOrderStatus.APPROVED]: [PurchaseOrderStatus.COMPLETED],
  [PurchaseOrderStatus.REJECTED]: [],
  [PurchaseOrderStatus.CANCELLED]: [],
  [PurchaseOrderStatus.COMPLETED]: [],
};
```

---

### 3.9 Policies

Business policies are evaluated (not thrown) — they return `true`/`false` and let the
caller decide what to do.

```ts
interface PolicyConfig {
  name: string;                // kebab-case policy name (e.g. 'product-reactivation')
  description: string;         // what the policy evaluates
  inputFields: string[];       // fields the policy needs (from aggregate state)
  returnType?: string;         // default: 'boolean'
}
```

**What gets generated:**

- `domain/policies/<kebab>.policy.ts` — policy registration
- Usage example in the aggregate (as a TODO if not obvious)

**Example:**

```ts
policies: [
  {
    name: 'purchase-order-approval',
    description: 'Orders above the auto-approve threshold require manual approval',
    inputFields: ['status', 'totalAmount', 'autoApproveThreshold'],
  },
]
```

---

### 3.10 Use Cases

Define which use cases to generate. The generator always produces standard CRUD use
cases; this section lets you add **custom** use cases.

```ts
interface UseCaseConfig {
  name: string;                    // PascalCase name (e.g. 'ChangePrice', 'SubmitOrder')
  type: 'command' | 'query';       // command mutates, query reads
  description?: string;
  inputFields?: PropertyConfig[];  // what the use case accepts
  returnType?: string;             // what it returns (default: entityName + 'Id' for commands)
  injects?: string[];              // additional ports to inject (e.g. ['NumberingPort'])
  transactional?: boolean;         // default: true for commands
}
```

**Standard use cases (always generated):**

| Use Case | Type | Description |
|---|---|---|
| `Create<Entity>` | command | Creates via factory, saves, appends to outbox |
| `Update<Entity>` | command | Finds by ID, calls aggregate `update()`, saves, appends to outbox |
| `Get<Entity>` | query | Finds by ID, throws NotFoundException |
| `List<Entities>` | query | Returns all records |

If `states` is defined, a `<Entity>StatusUseCase` is also generated for status transitions.

**Custom use case example:**

```ts
useCases: [
  {
    name: 'ChangePrice',
    type: 'command',
    inputFields: [
      { name: 'id', type: 'string' },
      { name: 'unitPrice', type: 'money' },
      { name: 'currency', type: 'string' },
    ],
  },
  {
    name: 'GetPurchasableProduct',
    type: 'query',
    inputFields: [{ name: 'id', type: 'string' }],
    returnType: 'Product | null',
  },
]
```

**What gets generated per custom use case:**

- `application/usecase/<kebab>.<use-case-kebab>.usecase.ts`

---

### 3.11 Cross-Module Ports

#### Outbound Ports (this module consumes from others)

```ts
interface OutboundPortConfig {
  name: string;              // PascalCase name (e.g. 'VendorQuery', 'ProductQuery')
  portClassName: string;     // the abstract class name (e.g. 'OrderableVendorQueryPort')
  methods: OutboundMethodConfig[];
  description?: string;      // why this module needs this data
}

interface OutboundMethodConfig {
  name: string;              // method name (e.g. 'getOrderableVendor')
  returnType: string;        // e.g. 'Promise<VendorReference | null>'
  params?: { name: string; type: string }[];
}
```

**What gets generated:**

- `application/ports/outbound/<kebab>-<port-kebab>.port.ts` — abstract class
- Types/interfaces for the return shapes in `domain/types/`
- Lazy resolver pattern in the use case that needs it

**Example:**

```ts
outboundPorts: [
  {
    name: 'VendorQuery',
    portClassName: 'OrderableVendorQueryPort',
    methods: [
      { name: 'getOrderableVendor', returnType: 'Promise<VendorReference | null>' },
    ],
  },
]
```

#### Inbound Ports (this module exposes to others)

```ts
interface InboundPortConfig {
  name: string;              // PascalCase name (e.g. 'PurchasableProductQuery')
  portClassName: string;     // the abstract class name
  methods: InboundMethodConfig[];
  adapterClass?: string;     // adapter class that implements this port
  implementsWith?: string;   // which use case implements it (e.g. 'GetPurchasableProductUseCase')
  description?: string;
}

interface InboundMethodConfig {
  name: string;
  returnType: string;
  params?: { name: string; type: string }[];
}
```

**What gets generated:**

- `domain/ports/<kebab>-<port-kebab>.port.ts` — abstract class in the consuming module's domain
- `application/adapters/<module>.adapter.ts` — adapter implementing the port via own use case
- Module binding: `{ provide: PortClass, useExisting: AdapterClass }`
- Module export of the port class

**Example:**

```ts
inboundPorts: [
  {
    name: 'PurchasableProductQuery',
    portClassName: 'PurchasableProductQueryPort',
    methods: [
      { name: 'getPurchasableProduct', returnType: 'Promise<ProductReference | null>', params: [{ name: 'id', type: 'string' }] },
    ],
    implementsWith: 'GetPurchasableProductUseCase',
  },
]
```

---

### 3.12 Prisma Model

Optional Prisma schema definition. If provided, generates the `.prisma` file.

```ts
interface PrismaModelConfig {
  modelName: string;           // PascalCase model name (e.g. 'PurchaseOrder')
  tableName?: string;          // snake_case table name (default: pluralized kebab → snake)
  fields: PrismaFieldConfig[];
  indexes?: PrismaIndexConfig[];
  enums?: PrismaEnumConfig[];  // Prisma-level enums
}

interface PrismaFieldConfig {
  name: string;
  type: string;                // Prisma type: String, Int, Float, Boolean, DateTime, Json, Decimal
  id?: boolean;
  unique?: boolean;
  required?: boolean;          // default: true
  default?: unknown;
  relation?: string;           // related model name
  relationFields?: string[];   // foreign key fields
}

interface PrismaIndexConfig {
  fields: string[];
  unique?: boolean;
}

interface PrismaEnumConfig {
  name: string;
  values: string[];
}
```

**What gets generated:**

- `prisma/schema/<kebab>.prisma` — Prisma model definition

---

### 3.13 Module Options

Fine-grained control over what the generator produces.

```ts
interface ModuleOptions {
  skipConsumers?: boolean;          // don't generate consumer files
  skipSwagger?: boolean;            // don't add @ApiTags / @ApiOperation decorators
  skipSpecFiles?: boolean;          // don't generate .spec.ts files
  customModuleFile?: boolean;       // use hand-written module file (don't overwrite)
  enablePagination?: boolean;       // use PageQuery/PageResult in list use case
  enableVersioning?: boolean;       // add API version prefix to controller route
  outboxEnabled?: boolean;          // default: true — append events to outbox in commands
  companyConfigEnabled?: boolean;   // default: true — inject CompanyConfigPort in commands
}
```

---

## 4. Complete Example

Here is a full configuration for a **PurchaseOrder** aggregate:

```ts
const config: AggregateModuleConfig = {
  // ── Identity ──
  name: 'purchase-order',
  context: 'procurement',
  displayName: 'PurchaseOrder',
  entityName: 'PurchaseOrder',
  entityNamePlural: 'PurchaseOrders',

  // ── Properties ──
  properties: [
    { name: 'orderNumber', type: 'string', required: true },
    { name: 'vendorId',    type: 'id',     required: true },
    { name: 'currency',    type: 'string', required: false, defaultValue: 'USD' },
  ],

  // ── Value Objects ──
  valueObjects: [
    {
      name: 'OrderNumber',
      wraps: 'string',
      normalize: 'trim-uppercase',
      invariants: [
        {
          name: 'order-number-format',
          rules: [
            { type: 'required', message: 'Order number cannot be empty' },
            { type: 'pattern', value: /^PO-\d{8}$/, message: 'Order number must match PO-XXXXXXXX format' },
          ],
        },
      ],
    },
    {
      name: 'VendorIdRef',
      wraps: 'id',
      normalize: 'none',
    },
    {
      name: 'ProductIdRef',
      wraps: 'id',
      normalize: 'none',
    },
  ],

  // ── Child Entities ──
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

  // ── States ──
  states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'],

  // ── Events ──
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

  // ── Invariants ──
  invariants: [
    {
      operation: 'create',
      name: 'purchase-order-has-vendor',
      field: 'vendorId',
      rules: [{ type: 'required', message: 'Vendor ID is required' }],
    },
  ],

  // ── Status Transitions ──
  statusTransitions: [
    { from: 'DRAFT',     to: 'SUBMITTED',  method: 'submit' },
    { from: 'SUBMITTED', to: 'APPROVED',   method: 'approve' },
    { from: 'SUBMITTED', to: 'REJECTED',   method: 'reject', guard: 'requires reason' },
    { from: 'SUBMITTED', to: 'CANCELLED',  method: 'cancel' },
    { from: 'APPROVED',  to: 'COMPLETED',  method: 'complete' },
  ],

  // ── Policies ──
  policies: [
    {
      name: 'purchase-order-approval',
      description: 'Orders above the auto-approve threshold require manual approval',
      inputFields: ['status', 'totalAmount', 'autoApproveThreshold'],
    },
  ],

  // ── Custom Use Cases ──
  useCases: [
    {
      name: 'AddPurchaseOrderLine',
      type: 'command',
      inputFields: [
        { name: 'id',        type: 'string' },
        { name: 'productId', type: 'string' },
        { name: 'quantity',  type: 'number' },
        { name: 'unitPrice', type: 'money' },
        { name: 'currency',  type: 'string' },
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

  // ── Cross-Module Ports ──
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

  // ── Prisma ──
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

  // ── Options ──
  options: {
    enablePagination: true,
  },
};

export default config;
```

---

## 5. What Gets Generated

For the config above, the generator produces:

```
src/business/procurement/purchase/
├── purchase-order.module.ts                          ← NestJS module
├── index.ts                                          ← barrel exports
│
├── domain/
│   ├── entities/
│   │   ├── purchase-order.aggregate.ts               ← aggregate root
│   │   ├── purchase-order.aggregate.spec.ts          ← unit test scaffold
│   │   ├── purchase-order-line.entity.ts             ← child entity
│   │   └── purchase-order.invariants.ts              ← invariant registrations
│   │
│   ├── types/
│   │   ├── purchase-order.enum.ts                    ← status enum
│   │   └── purchase-order.types.ts                   ← Props, Inputs, Requests, References
│   │
│   ├── value-objects/
│   │   ├── purchase-order-id.vo.ts                   ← aggregate ID value object
│   │   ├── order-number.vo.ts                        ← OrderNumber value object
│   │   ├── order-number.invariants.ts                ← OrderNumber invariants
│   │   ├── vendor-id-ref.vo.ts                       ← VendorIdRef value object
│   │   ├── product-id-ref.vo.ts                      ← ProductIdRef value object
│   │   └── index.ts
│   │
│   ├── events/
│   │   ├── purchase-order.created.event.ts
│   │   ├── purchase-order.submitted.event.ts
│   │   ├── purchase-order.approved.event.ts
│   │   ├── purchase-order.rejected.event.ts
│   │   ├── purchase-order.cancelled.event.ts
│   │   ├── purchase-order.completed.event.ts
│   │   ├── purchase-order.line-added.event.ts
│   │   ├── purchase-order.line-removed.event.ts
│   │   ├── purchase-order.registry.ts                ← event rehydrators
│   │   └── index.ts
│   │
│   ├── factories/
│   │   ├── purchase-order.factory.ts                 ← domain factory
│   │   └── index.ts
│   │
│   ├── policies/
│   │   └── purchase-order.policy.ts                  ← policy registration
│   │
│   ├── ports/
│   │   ├── purchase-order-command-repository.port.ts ← abstract command repo
│   │   ├── purchase-order-query-repository.port.ts   ← abstract query repo
│   │   └── index.ts
│   │
│   └── errors/
│       └── (empty, ready for domain errors)
│
├── application/
│   ├── usecase/
│   │   ├── create-purchase-order.usecase.ts
│   │   ├── update-purchase-order.usecase.ts
│   │   ├── purchase-order-transition.usecase.ts
│   │   ├── add-purchase-order-line.usecase.ts
│   │   ├── remove-purchase-order-line.usecase.ts
│   │   ├── get-purchase-order.usecase.ts
│   │   ├── list-purchase-orders.usecase.ts
│   │   └── index.ts
│   │
│   ├── consumers/
│   │   ├── purchase-order.event-emitter.consumer.ts
│   │   ├── purchase-order.kafka.consumer.ts
│   │   ├── purchase-order.rabbitmq.consumer.ts
│   │   ├── purchase-order.sqs.consumer.ts
│   │   └── index.ts
│   │
│   ├── adapters/                                      ← (empty, for inbound port adapters)
│   │   └── index.ts
│   │
│   └── ports/
│       └── outbound/
│           ├── purchase-order-vendor-query.port.ts   ← outbound port
│           ├── purchase-order-product-query.port.ts  ← outbound port
│           └── index.ts
│
├── infrastructure/
│   └── persistence/
│       ├── purchase-order.mapper.ts                   ← domain ↔ Prisma mapper
│       ├── prisma-purchase-order-command.repository.ts
│       ├── prisma-purchase-order-query.repository.ts
│       └── index.ts
│
└── presentation/
    └── http/
        ├── controllers/
        │   └── purchase-order.controller.ts
        └── request/
            └── purchase-order.request.ts             ← request DTOs

prisma/schema/
└── purchase-order.prisma                              ← Prisma model definition
```

**Total: ~35 files** generated from a single config object.

---

## 6. Naming Conventions

All naming derives from the `name` and `entityName` fields:

| Artifact | Pattern | Example (`name='purchase-order'`, `entityName='PurchaseOrder'`) |
|---|---|---|
| Module class | `<EntityName>Module` | `PurchaseOrderModule` |
| Module file | `<name>.module.ts` | `purchase-order.module.ts` |
| Aggregate file | `<entity-name>.aggregate.ts` | `purchase-order.aggregate.ts` |
| Enum file | `<name>.enum.ts` | `purchase-order.enum.ts` |
| Types file | `<name>.types.ts` | `purchase-order.types.ts` |
| ID value object | `<entity-name>-id.vo.ts` | `purchase-order-id.vo.ts` |
| Other value objects | `<kebab>.vo.ts` | `order-number.vo.ts` |
| Event file | `<name>.<event-kebab>.event.ts` | `purchase-order.submitted.event.ts` |
| Registry file | `<name>.registry.ts` | `purchase-order.registry.ts` |
| Invariants file | `<name>.invariants.ts` | `purchase-order.invariants.ts` |
| Factory file | `<entity-name>.factory.ts` | `purchase-order.factory.ts` |
| Policy file | `<name>.policy.ts` | `purchase-order.policy.ts` |
| Repository port | `<name>-command-repository.port.ts` | `purchase-order-command-repository.port.ts` |
| Use case file | `<name>.<use-case-kebab>.usecase.ts` | `purchase-order-transition.usecase.ts` |
| Consumer file | `<name>.<broker>.consumer.ts` | `purchase-order.kafka.consumer.ts` |
| Controller file | `<name>.controller.ts` | `purchase-order.controller.ts` |
| Request DTO file | `<name>.request.ts` | `purchase-order.request.ts` |
| Mapper file | `<name>.mapper.ts` | `purchase-order.mapper.ts` |
| Prisma repository | `prisma-<entity-name>-command.repository.ts` | `prisma-purchase-order-command.repository.ts` |
| Prisma model file | `<name>.prisma` | `purchase-order.prisma` |

---

## Appendix: Property Type → Code Mapping

### How `money` properties work

When a property has `type: 'money'`:

1. **Domain**: The aggregate stores a `Money` value object (from `@business/shared-business`)
2. **Props interface**: `unitPrice: Money`
3. **Input DTO**: `unitPrice: number` (amount in minor units or major units — your choice)
4. **Factory**: Accepts `Money` or number, wraps in `Money.fromMinorUnits()` or `Money.of()`
5. **Mapper**: Converts between `Money` value object and Prisma `Decimal` + currency column
6. **Prisma**: Two columns: `unitPrice: Decimal` + `currency: String`

### How `enum` properties work

When a property has `type: 'enum'`:

1. **Domain**: TypeScript string union or enum type
2. **Props interface**: `status: string` (or the enum type if `states` is defined)
3. **Input DTO**: `string`
4. **Prisma**: `String` column (or Prisma enum if `prismaModel.enums` is provided)

### How `id` properties work

When a property has `type: 'id'`:

1. **Domain**: `string` (UUID)
2. **Props interface**: `vendorId: string`
3. **Input DTO**: `string`
4. **Prisma**: `String` column with `@db.Uuid` or plain `String`

---

## Appendix: Generator CLI Usage

```bash
# Generate from a config file
npx tsx scripts/generators/module.generator.ts --config scripts/generators/configs/purchase-order.config.ts

# Force overwrite existing files
npx tsx scripts/generators/module.generator.ts --config scripts/generators/configs/purchase-order.config.ts --force

# Generate with inline config (for quick tests)
npx tsx scripts/generators/module.generator.ts --name my-module --context my-context

# Sync barrel index files for all modules
npx tsx scripts/generators/sync-barrels.ts
```

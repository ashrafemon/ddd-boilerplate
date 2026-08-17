# Module Generator

Idempotent module generator for NestJS DDD boilerplate. Generates complete business modules with barrel-indexed domain, application, infrastructure, and presentation layers.

## Quick Start

```bash
# Generate from config file
npx tsx scripts/generators/module.generator.ts --config scripts/generators/configs/product.config.ts

# Force overwrite existing files
npx tsx scripts/generators/module.generator.ts --config scripts/generators/configs/product.config.ts --force

# Sync barrel index files for all modules
npx tsx scripts/generators/sync-barrels.ts
```

## Config Schema

```ts
interface ModuleConfig {
  name: string;              // e.g. 'product', 'vendor', 'purchase-order'
  context: string;           // e.g. 'catalog', 'party', 'procurement'
  displayName: string;       // e.g. 'Product', 'Vendor'
  entityName: string;        // singular PascalCase
  entityNamePlural: string;  // plural PascalCase
  modulePath?: string;       // optional full path override
  properties?: PropertyConfig[];
  states?: string[];         // enum values for status
  events?: EventConfig[];
  outboundPorts?: { name: string; portName: string; method: string; returnType: string }[];
}

interface PropertyConfig {
  name: string;
  type: 'string' | 'text' | 'money' | 'boolean' | 'enum' | 'id';
  required?: boolean;
  maxLength?: number;
  values?: string[];
}

interface EventConfig {
  name: string;        // e.g. 'Created', 'Updated'
  fields?: string[];   // extra payload fields beyond entityId
}
```

## Generated Structure

```
src/business/<context>/<module>/
├── <module>.module.ts
├── domain/
│   ├── entities/
│   │   ├── <entity>.aggregate.ts
│   │   ├── <entity>.aggregate.spec.ts
│   │   └── <entity>.invariants.ts
│   ├── value-objects/
│   │   ├── <entity>-id.vo.ts
│   │   └── <module>.vos.ts
│   ├── events/
│   │   ├── <module>.registry.ts
│   │   ├── <module>.created.event.ts
│   │   └── ...
│   ├── factories/
│   │   └── <entity>.factory.ts
│   ├── invariants/
│   ├── policies/
│   │   └── <module>.policy.ts
│   └── ports/
│       ├── <module>-command-repository.port.ts
│       └── <module>-query-repository.port.ts
├── application/
│   ├── adapters/
│   ├── consumers/
│   │   ├── <module>.event-emitter.consumer.ts
│   │   ├── <module>.kafka.consumer.ts
│   │   ├── <module>.rabbitmq.consumer.ts
│   │   └── <module>.sqs.consumer.ts
│   └── usecase/
│       ├── create-<module>.usecase.ts
│       ├── update-<module>.usecase.ts
│       ├── get-<module>.usecase.ts
│       └── list-<module>s.usecase.ts
├── infrastructure/
│   └── persistence/
│       ├── <module>.mapper.ts
│       ├── prisma-<entity>-command.repository.ts
│       └── prisma-<entity>-query.repository.ts
└── presentation/
    └── http/
        ├── controllers/
        │   └── <module>.controller.ts
        └── request/
            └── <module>.request.ts
```

## Barrel Indexing

Every directory with generated files gets an auto-synced `index.ts`:

```
domain/value-objects/index.ts
  export * from './product-id.vo';
  export * from './product.vos';
  export * from './sku';
```

New files are auto-discovered. Deleted files are auto-removed. Run `sync-barrels.ts` after manual changes.

## Regeneration Strategy

The generator is **idempotent by default**:
- Existing files with identical content are skipped
- Use `--force` to overwrite
- New config fields add new files/code blocks
- Removed config fields leave orphaned files (delete manually or run cleanup)

### Safe Regeneration Workflow

1. Update config (add property, event, state)
2. Run generator (skips unchanged files)
3. Run barrel sync
4. Manually delete files for removed features
5. Run tests
